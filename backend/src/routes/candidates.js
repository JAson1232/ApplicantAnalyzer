const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { uploadCandidateMiddleware } = require('../middleware/upload');
const { scoreCandidateTest, resolveModelSelection } = require('../services/aiScorer');

const router = express.Router();
const uploadRoot = process.env.UPLOAD_DIR || '/app/uploads';

router.use(authenticateToken, requireRole('university'));

async function withUniversityProfile(req, res, next) {
  try {
    const result = await query('SELECT id FROM universities WHERE user_id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'University profile not found' });
    }
    req.universityProfileId = result.rows[0].id;
    return next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

router.use(withUniversityProfile);

function candidatePublicPath(universityId, candidateId, fileName) {
  return `/uploads/candidates/${universityId}/${candidateId}/${fileName}`;
}

function mapCandidate(row) {
  return {
    id: row.id,
    university_id: row.university_id,
    name: row.name,
    personal_statement_path: row.personal_statement_path || null,
    transcript_path: row.transcript_path || null,
    cv_path: row.cv_path || null,
    created_at: row.created_at
  };
}

function mapTest(row) {
  return {
    id: row.id,
    candidate_id: row.candidate_id,
    degree_id: row.degree_id,
    degree_title: row.degree_title || null,
    ai_score: row.ai_score !== null && row.ai_score !== undefined ? Number(row.ai_score) : null,
    ai_provider: row.ai_provider || null,
    ai_model: row.ai_model || null,
    ai_reasoning: row.ai_reasoning || null,
    ai_full_result: row.ai_full_result || null,
    ai_pass1_extraction: row.ai_pass1_extraction || null,
    status: row.status,
    created_at: row.created_at,
    scored_at: row.scored_at || null
  };
}

// ── Overview (must be before /:candidateId routes) ────────────────────────────

// GET /overview — all candidates with their tests, for the dashboard
router.get('/overview', async (req, res) => {
  try {
    const candidatesResult = await query(
      `SELECT id, name, personal_statement_path, transcript_path, cv_path, created_at
       FROM manual_candidates
       WHERE university_id = $1
       ORDER BY created_at DESC`,
      [req.universityProfileId]
    );

    const testsResult = await query(
      `SELECT ct.id, ct.candidate_id, ct.degree_id,
              d.course_name AS degree_title,
              ct.ai_score, ct.ai_provider, ct.status, ct.created_at, ct.scored_at
       FROM candidate_tests ct
       JOIN degree_listings d ON d.id = ct.degree_id
       JOIN manual_candidates mc ON mc.id = ct.candidate_id
       WHERE mc.university_id = $1
       ORDER BY ct.created_at DESC`,
      [req.universityProfileId]
    );

    return res.json({
      candidates: candidatesResult.rows,
      tests: testsResult.rows
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Candidates ────────────────────────────────────────────────────────────────

// POST / — create candidate (JSON body: { name })
router.post('/', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await query(
      `INSERT INTO manual_candidates (university_id, name)
       VALUES ($1, $2)
       RETURNING id, university_id, name, personal_statement_path, transcript_path, cv_path, created_at`,
      [req.universityProfileId, name]
    );

    return res.status(201).json({ candidate: mapCandidate(result.rows[0]) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET / — list all candidates for this university
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, university_id, name,
              personal_statement_path, transcript_path, cv_path, created_at
       FROM manual_candidates
       WHERE university_id = $1
       ORDER BY created_at DESC`,
      [req.universityProfileId]
    );
    return res.json({ candidates: result.rows.map(mapCandidate) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /:candidateId — get candidate detail
router.get('/:candidateId', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, university_id, name,
              personal_statement_path, transcript_path, cv_path, created_at
       FROM manual_candidates
       WHERE id = $1 AND university_id = $2`,
      [req.params.candidateId, req.universityProfileId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    return res.json({ candidate: mapCandidate(result.rows[0]) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /:candidateId — delete candidate and their files
router.delete('/:candidateId', async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM manual_candidates WHERE id = $1 AND university_id = $2 RETURNING id`,
      [req.params.candidateId, req.universityProfileId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });

    // Best-effort cleanup of uploaded files
    const dir = path.join(uploadRoot, 'candidates', String(req.universityProfileId), String(req.params.candidateId));
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /:candidateId/files — upload/replace files for an existing candidate
async function attachExistingCandidateId(req, res, next) {
  try {
    const result = await query(
      'SELECT id FROM manual_candidates WHERE id = $1 AND university_id = $2',
      [req.params.candidateId, req.universityProfileId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    req.candidateId = req.params.candidateId;
    return next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

router.put('/:candidateId/files', attachExistingCandidateId, uploadCandidateMiddleware, async (req, res) => {
  try {
    const ps = req.files?.personal_statement?.[0];
    const transcript = req.files?.transcript?.[0];
    const cv = req.files?.cv?.[0];

    if (!ps && !transcript && !cv) {
      return res.status(400).json({ error: 'At least one file must be uploaded' });
    }

    const updates = [];
    const values = [req.candidateId];

    if (ps) {
      updates.push(`personal_statement_path = $${values.length + 1}`);
      values.push(candidatePublicPath(req.universityProfileId, req.candidateId, ps.filename));
    }
    if (transcript) {
      updates.push(`transcript_path = $${values.length + 1}`);
      values.push(candidatePublicPath(req.universityProfileId, req.candidateId, transcript.filename));
    }
    if (cv) {
      updates.push(`cv_path = $${values.length + 1}`);
      values.push(candidatePublicPath(req.universityProfileId, req.candidateId, cv.filename));
    }

    const result = await query(
      `UPDATE manual_candidates SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING id, university_id, name, personal_statement_path, transcript_path, cv_path, created_at`,
      values
    );

    return res.json({ candidate: mapCandidate(result.rows[0]) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Candidate Tests ───────────────────────────────────────────────────────────

async function checkCandidateOwnership(candidateId, universityId) {
  const result = await query(
    'SELECT id FROM manual_candidates WHERE id = $1 AND university_id = $2',
    [candidateId, universityId]
  );
  return result.rows.length > 0;
}

async function checkTestOwnership(testId, candidateId, universityId) {
  const result = await query(
    `SELECT ct.id FROM candidate_tests ct
     JOIN manual_candidates mc ON mc.id = ct.candidate_id
     WHERE ct.id = $1 AND ct.candidate_id = $2 AND mc.university_id = $3`,
    [testId, candidateId, universityId]
  );
  return result.rows.length > 0;
}

// GET /:candidateId/tests — list all tests for a candidate
router.get('/:candidateId/tests', async (req, res) => {
  try {
    const owned = await checkCandidateOwnership(req.params.candidateId, req.universityProfileId);
    if (!owned) return res.status(404).json({ error: 'Candidate not found' });

    const result = await query(
      `SELECT ct.id, ct.candidate_id, ct.degree_id,
              d.course_name AS degree_title,
              ct.ai_score, ct.ai_provider, ct.ai_model, ct.ai_reasoning,
              ct.ai_full_result, ct.ai_pass1_extraction,
              ct.status, ct.created_at, ct.scored_at
       FROM candidate_tests ct
       JOIN degree_listings d ON d.id = ct.degree_id
       WHERE ct.candidate_id = $1
       ORDER BY ct.created_at DESC`,
      [req.params.candidateId]
    );

    return res.json({ tests: result.rows.map(mapTest) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /:candidateId/tests — create a test and trigger scoring
router.post('/:candidateId/tests', async (req, res) => {
  try {
    const owned = await checkCandidateOwnership(req.params.candidateId, req.universityProfileId);
    if (!owned) return res.status(404).json({ error: 'Candidate not found' });

    const { degree_id, provider } = req.body;
    if (!degree_id) return res.status(400).json({ error: 'degree_id is required' });

    // Validate degree belongs to this university
    const degreeResult = await query(
      'SELECT id, required_files, course_name FROM degree_listings WHERE id = $1 AND university_id = $2',
      [degree_id, req.universityProfileId]
    );
    if (degreeResult.rows.length === 0) return res.status(404).json({ error: 'Degree not found' });

    let modelSelection;
    try {
      modelSelection = resolveModelSelection({ provider });
    } catch (error) {
      const isConfigError = /_API_KEY/.test(error.message);
      return res.status(isConfigError ? 500 : 400).json({ error: error.message });
    }

    // Validate candidate has the required files for this degree
    const candidateResult = await query(
      'SELECT personal_statement_path, transcript_path, cv_path FROM manual_candidates WHERE id = $1',
      [req.params.candidateId]
    );
    const candidate = candidateResult.rows[0];
    const degree = degreeResult.rows[0];
    const requiredFiles = Array.isArray(degree.required_files) && degree.required_files.length > 0
      ? degree.required_files
      : ['personal_statement', 'transcript', 'cv'];

    const missing = requiredFiles.filter((f) => {
      if (f === 'personal_statement') return !candidate.personal_statement_path;
      if (f === 'transcript') return !candidate.transcript_path;
      if (f === 'cv') return !candidate.cv_path;
      return false;
    });
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Candidate is missing files required by this degree: ${missing.join(', ')}`
      });
    }

    // Create the test record
    const testResult = await query(
      `INSERT INTO candidate_tests (candidate_id, degree_id, ai_provider, ai_model, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, candidate_id, degree_id, ai_provider, ai_model, status, created_at`,
      [req.params.candidateId, degree_id, modelSelection.provider, modelSelection.model]
    );

    const test = testResult.rows[0];

    // Fire scoring in the background
    scoreCandidateTest(test.id, {
      force: true,
      provider: modelSelection.provider,
      model: modelSelection.model
    }).catch((err) => {
      console.error(`Background candidate test scoring failed for test ${test.id}:`, err.message);
    });

    return res.status(202).json({
      test: { ...mapTest(test), degree_title: degree.course_name },
      queued: true,
      provider: modelSelection.provider,
      model: modelSelection.model
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /:candidateId/tests/:testId — get test detail
router.get('/:candidateId/tests/:testId', async (req, res) => {
  try {
    const owned = await checkTestOwnership(req.params.testId, req.params.candidateId, req.universityProfileId);
    if (!owned) return res.status(404).json({ error: 'Test not found' });

    const result = await query(
      `SELECT ct.id, ct.candidate_id, ct.degree_id,
              d.course_name AS degree_title,
              mc.name AS candidate_name,
              ct.ai_score, ct.ai_provider, ct.ai_model, ct.ai_reasoning,
              ct.ai_full_result, ct.ai_pass1_extraction,
              ct.status, ct.created_at, ct.scored_at
       FROM candidate_tests ct
       JOIN degree_listings d ON d.id = ct.degree_id
       JOIN manual_candidates mc ON mc.id = ct.candidate_id
       WHERE ct.id = $1`,
      [req.params.testId]
    );

    const row = result.rows[0];
    return res.json({
      test: { ...mapTest(row), candidate_name: row.candidate_name }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /:candidateId/tests/:testId/trigger — re-trigger scoring
router.post('/:candidateId/tests/:testId/trigger', async (req, res) => {
  try {
    const owned = await checkTestOwnership(req.params.testId, req.params.candidateId, req.universityProfileId);
    if (!owned) return res.status(404).json({ error: 'Test not found' });

    const { provider } = req.body;
    let modelSelection;
    try {
      modelSelection = resolveModelSelection({ provider });
    } catch (error) {
      const isConfigError = /_API_KEY/.test(error.message);
      return res.status(isConfigError ? 500 : 400).json({ error: error.message });
    }

    const current = await query('SELECT status FROM candidate_tests WHERE id = $1', [req.params.testId]);
    if (current.rows[0]?.status === 'pending') {
      return res.status(409).json({ error: 'Scoring already in progress. Cancel it first.' });
    }

    await query(
      `UPDATE candidate_tests
       SET status = 'pending',
           ai_score = NULL,
           ai_reasoning = NULL,
           ai_full_result = NULL,
           ai_pass1_extraction = NULL,
           ai_provider = $2,
           ai_model = $3,
           scored_at = NULL
       WHERE id = $1`,
      [req.params.testId, modelSelection.provider, modelSelection.model]
    );

    scoreCandidateTest(req.params.testId, {
      force: true,
      provider: modelSelection.provider,
      model: modelSelection.model
    }).catch((err) => {
      console.error(`Background re-score failed for test ${req.params.testId}:`, err.message);
    });

    return res.status(202).json({ queued: true, provider: modelSelection.provider, model: modelSelection.model });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /:candidateId/tests/:testId/cancel — cancel pending scoring
router.post('/:candidateId/tests/:testId/cancel', async (req, res) => {
  try {
    const owned = await checkTestOwnership(req.params.testId, req.params.candidateId, req.universityProfileId);
    if (!owned) return res.status(404).json({ error: 'Test not found' });

    const result = await query(
      `UPDATE candidate_tests
       SET status = 'awaiting_model_selection',
           ai_score = NULL,
           ai_reasoning = NULL,
           ai_full_result = NULL,
           ai_pass1_extraction = NULL,
           scored_at = NULL
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [req.params.testId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Only pending tests can be cancelled.' });
    }

    return res.json({ cancelled: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /:candidateId/tests/:testId/status — lightweight poll endpoint
router.get('/:candidateId/tests/:testId/status', async (req, res) => {
  try {
    const owned = await checkTestOwnership(req.params.testId, req.params.candidateId, req.universityProfileId);
    if (!owned) return res.status(404).json({ error: 'Test not found' });

    const result = await query(
      'SELECT status, ai_score, ai_provider, ai_model, scored_at FROM candidate_tests WHERE id = $1',
      [req.params.testId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Test not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
