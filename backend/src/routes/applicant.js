const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { uploadMiddleware, uploadProfileMiddleware } = require('../middleware/upload');
const { generateSuggestions } = require('../services/aiScorer');

const uploadRoot = process.env.UPLOAD_DIR || '/app/uploads';

function profileDocFsPath(applicantId, fieldname) {
  return path.join(uploadRoot, String(applicantId), 'profile', fieldname + '.pdf');
}

function copyFileToProfile(applicantId, srcFsPath, fieldname) {
  const destDir = path.join(uploadRoot, String(applicantId), 'profile');
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcFsPath, path.join(destDir, fieldname + '.pdf'));
}

function copyFileFromProfile(applicantId, appId, fieldname) {
  const srcPath = profileDocFsPath(applicantId, fieldname);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`No saved ${fieldname.replace(/_/g, ' ')} found — please upload one`);
  }
  const destDir = path.join(uploadRoot, String(applicantId), String(appId));
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcPath, path.join(destDir, fieldname + '.pdf'));
  return `/uploads/${applicantId}/${appId}/${fieldname}.pdf`;
}

const router = express.Router();

router.use(authenticateToken, requireRole('applicant'));

async function withApplicantProfile(req, res, next) {
  req.startedAt = Date.now();
  try {
    const result = await query('SELECT id FROM applicants WHERE user_id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Applicant profile not found' });
    }
    req.applicantProfileId = result.rows[0].id;
    console.info(`[profile][user:${req.user.id}] resolved in ${Date.now() - req.startedAt}ms`);
    return next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

router.use(withApplicantProfile);

const ALL_FILES = ['personal_statement', 'transcript', 'cv'];

function normalizeRequiredFiles(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value.filter((f) => ALL_FILES.includes(f));
  }
  return ALL_FILES;
}

function toPublicDegree(row) {
  return {
    id: row.id,
    university_id: row.university_id,
    course_name: row.course_name,
    department: row.department,
    duration_years: row.duration_years,
    public_description: row.public_description,
    public_requirements: row.public_requirements,
    required_files: normalizeRequiredFiles(row.required_files),
    created_at: row.created_at,
    title: row.course_name,
    description: row.public_description,
    requirements: row.public_requirements
  };
}

function publicUploadPath(applicantId, applicationId, fileName) {
  return `/uploads/${applicantId}/${applicationId}/${fileName}`;
}

router.get('/degrees', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, university_id, course_name, department, duration_years,
              public_description, public_requirements, required_files, created_at
       FROM degree_listings
       ORDER BY created_at DESC`
    );
    return res.json({ degrees: result.rows.map(toPublicDegree) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/degrees/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, university_id, course_name, department, duration_years,
              public_description, public_requirements, required_files, created_at
       FROM degree_listings
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }

    return res.json({ degree: toPublicDegree(result.rows[0]) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

async function reserveApplication(req, res, next) {
  const startedAt = Date.now();
  console.info(`[apply][user:${req.user.id}] reserving for degree=${req.params.degreeId}`);
  try {
    const degreeId = req.params.degreeId;
    if (!degreeId) {
      return res.status(400).json({ error: 'Invalid degreeId' });
    }

    const degree = await query('SELECT id, required_files FROM degree_listings WHERE id = $1', [degreeId]);
    if (degree.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }

    req.degreeRequiredFiles = normalizeRequiredFiles(degree.rows[0].required_files);

    const inserted = await query(
      `INSERT INTO applications (degree_id, applicant_id)
       VALUES ($1, $2)
       RETURNING id`,
      [degreeId, req.applicantProfileId]
    );

    req.applicationId = inserted.rows[0].id;
    console.info(
      `[apply][user:${req.user.id}][app:${req.applicationId}] reserved for degree=${degreeId} in ${Date.now() - startedAt}ms`
    );
    return next();
  } catch (error) {
    console.error(`[apply][user:${req.user?.id || 'unknown'}] reserve failed: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

async function applyHandler(req, res) {
  const appId = req.applicationId;
  const applicantId = req.applicantProfileId;
  const startedAt = Date.now();
  const reqTag = `[apply][user:${req.user?.id || 'unknown'}][app:${appId || 'unknown'}]`;
  try {
    console.info(`${reqTag} apply handler entered`);
    const requiredFiles = req.degreeRequiredFiles || ALL_FILES;

    const uploadedPS = req.files?.personal_statement?.[0];
    const uploadedTranscript = req.files?.transcript?.[0];
    const uploadedCV = req.files?.cv?.[0];

    const useSavedPS = req.body?.use_saved_personal_statement === 'true';
    const useSavedTranscript = req.body?.use_saved_transcript === 'true';
    const useSavedCV = req.body?.use_saved_cv === 'true';

    // Fetch the applicant's saved profile docs to validate "use saved" requests
    const profileResult = await query(
      `SELECT personal_statement_path, transcript_path, cv_path FROM applicants WHERE id = $1`,
      [applicantId]
    );
    const savedDocs = profileResult.rows[0] || {};

    // Validate: every required file must be either newly uploaded or have a saved copy
    const missing = requiredFiles.filter((field) => {
      if (field === 'personal_statement') return !uploadedPS && !(useSavedPS && savedDocs.personal_statement_path);
      if (field === 'transcript')         return !uploadedTranscript && !(useSavedTranscript && savedDocs.transcript_path);
      if (field === 'cv')                 return !uploadedCV && !(useSavedCV && savedDocs.cv_path);
      return false;
    });
    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }

    // Resolve final paths and track profile updates from newly uploaded files
    let personalStatementPath = null;
    let transcriptPath = null;
    let cvPath = null;
    const profileUpdates = {};

    if (requiredFiles.includes('personal_statement')) {
      if (uploadedPS) {
        personalStatementPath = publicUploadPath(applicantId, appId, uploadedPS.filename);
        copyFileToProfile(applicantId, uploadedPS.path, 'personal_statement');
        profileUpdates.personal_statement_path = `/uploads/${applicantId}/profile/personal_statement.pdf`;
      } else if (useSavedPS) {
        personalStatementPath = copyFileFromProfile(applicantId, appId, 'personal_statement');
      }
    }

    if (requiredFiles.includes('transcript')) {
      if (uploadedTranscript) {
        transcriptPath = publicUploadPath(applicantId, appId, uploadedTranscript.filename);
        copyFileToProfile(applicantId, uploadedTranscript.path, 'transcript');
        profileUpdates.transcript_path = `/uploads/${applicantId}/profile/transcript.pdf`;
      } else if (useSavedTranscript) {
        transcriptPath = copyFileFromProfile(applicantId, appId, 'transcript');
      }
    }

    if (requiredFiles.includes('cv')) {
      if (uploadedCV) {
        cvPath = publicUploadPath(applicantId, appId, uploadedCV.filename);
        copyFileToProfile(applicantId, uploadedCV.path, 'cv');
        profileUpdates.cv_path = `/uploads/${applicantId}/profile/cv.pdf`;
      } else if (useSavedCV) {
        cvPath = copyFileFromProfile(applicantId, appId, 'cv');
      }
    }

    const updated = await query(
      `UPDATE applications
       SET personal_statement_path = $2,
           transcript_path = $3,
           cv_path = $4,
           status = 'awaiting_model_selection',
           submitted_at = NOW()
       WHERE id = $1
       RETURNING id, degree_id, applicant_id, status, submitted_at`,
      [appId, personalStatementPath, transcriptPath, cvPath]
    );

    // Persist any newly uploaded files back to the profile
    if (Object.keys(profileUpdates).length > 0) {
      const fields = Object.keys(profileUpdates);
      const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      await query(
        `UPDATE applicants SET ${setClauses}, documents_updated_at = NOW() WHERE id = $1`,
        [applicantId, ...fields.map((f) => profileUpdates[f])]
      );
    }

    const application = updated.rows[0];
    console.info(`${reqTag} submitted in ${Date.now() - startedAt}ms status=${application.status}`);

    return res.status(201).json({
      application,
      message: 'Application submitted. Admissions will choose an AI model and queue processing.'
    });
  } catch (error) {
    console.error(`${reqTag} apply failed after ${Date.now() - startedAt}ms: ${error.message}`);
    if (appId) {
      await query('DELETE FROM applications WHERE id = $1', [appId]);
    }
    [req.files?.personal_statement?.[0]?.path, req.files?.transcript?.[0]?.path, req.files?.cv?.[0]?.path]
      .filter(Boolean)
      .forEach((filePath) => { try { fs.unlinkSync(filePath); } catch (_) {} });

    return res.status(400).json({ error: error.message });
  }
}

router.post('/apply/:degreeId', reserveApplication, uploadMiddleware, applyHandler);
router.post('/degrees/:degreeId/apply', reserveApplication, uploadMiddleware, applyHandler);

router.get('/applications', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.degree_id, d.course_name AS degree_title, a.status,
              a.ai_score, a.ai_provider, a.ai_model, a.ai_reasoning, a.submitted_at, a.scored_at
       FROM applications a
       JOIN degree_listings d ON d.id = a.degree_id
       WHERE a.applicant_id = $1
       ORDER BY a.submitted_at DESC`,
      [req.applicantProfileId]
    );
    return res.json({ applications: result.rows });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/applications/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.degree_id, d.course_name AS degree_title, a.status,
              a.ai_score, a.ai_provider, a.ai_model, a.ai_reasoning,
              a.ai_suggestions, a.submitted_at, a.scored_at
       FROM applications a
       JOIN degree_listings d ON d.id = a.degree_id
       WHERE a.id = $1 AND a.applicant_id = $2`,
      [req.params.id, req.applicantProfileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    return res.json({ application: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const result = await query(
      `SELECT ap.full_name, ap.personal_statement_path, ap.transcript_path, ap.cv_path,
              ap.documents_updated_at, u.email
       FROM applicants ap
       JOIN users u ON u.id = ap.user_id
       WHERE ap.id = $1`,
      [req.applicantProfileId]
    );
    return res.json({ profile: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/profile/documents', uploadProfileMiddleware, async (req, res) => {
  try {
    const ps = req.files?.personal_statement?.[0];
    const transcript = req.files?.transcript?.[0];
    const cv = req.files?.cv?.[0];

    if (!ps && !transcript && !cv) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const updates = {};
    if (ps)         updates.personal_statement_path = `/uploads/${req.applicantProfileId}/profile/personal_statement.pdf`;
    if (transcript) updates.transcript_path         = `/uploads/${req.applicantProfileId}/profile/transcript.pdf`;
    if (cv)         updates.cv_path                 = `/uploads/${req.applicantProfileId}/profile/cv.pdf`;

    const fields = Object.keys(updates);
    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    await query(
      `UPDATE applicants SET ${setClauses}, documents_updated_at = NOW() WHERE id = $1`,
      [req.applicantProfileId, ...fields.map((f) => updates[f])]
    );

    const result = await query(
      `SELECT personal_statement_path, transcript_path, cv_path, documents_updated_at
       FROM applicants WHERE id = $1`,
      [req.applicantProfileId]
    );
    return res.json({ profile: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/applications/:id/suggestions', async (req, res) => {
  try {
    const appResult = await query(
      `SELECT id, status FROM applications WHERE id = $1 AND applicant_id = $2`,
      [req.params.id, req.applicantProfileId]
    );
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const { status } = appResult.rows[0];
    if (status !== 'scored' && status !== 'reviewed') {
      return res.status(400).json({ error: 'Suggestions are only available for scored applications' });
    }

    const suggestions = await generateSuggestions(req.params.id);
    return res.json({ suggestions });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
