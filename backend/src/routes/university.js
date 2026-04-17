const https = require('https');
const http = require('http');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const AUTOFILL_MODEL = 'claude-sonnet-4-20250514';

function fetchPageText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft === 0) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 ApplicantAnalyser/1.0', Accept: 'text/html' }, timeout: 15000 },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          res.resume();
          return resolve(fetchPageText(next, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} when fetching URL`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf8');
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 10000);
          resolve(text);
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

function stripFences(text) {
  return text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
}

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

const ALL_FILES = ['personal_statement', 'transcript', 'cv'];

function normalizeRequiredFiles(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value.filter((f) => ALL_FILES.includes(f));
  }
  return ALL_FILES;
}

function mapDegreeRow(row, includeHidden = true) {
  const base = {
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
  if (includeHidden) {
    base.hidden_criteria = row.hidden_criteria;
  }
  return base;
}

router.post('/degrees/autofill', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'URL must use http or https' });
    }

    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');

    const pageText = await fetchPageText(url);

    const client = new Anthropic();
    const prompt = `You are an admissions assistant helping a university create a degree listing. Given the raw text scraped from a university degree programme web page, extract and generate the information below.

Return ONLY a valid JSON object — no markdown, no extra text.

{
  "title": "Full official degree title (e.g. 'BSc Computer Science')",
  "description": "3-4 sentence public description of the programme — what it covers, who it suits, and what graduates typically do. Should be compelling for prospective applicants.",
  "requirements": "Entry requirements as a clear paragraph or list. Include academic grades, subject prerequisites, language requirements, and any other criteria mentioned.",
  "hidden_criteria": "Internal admissions scoring guidance: what qualities, experiences, and attributes would make an ideal candidate based on what this programme emphasises. Write as concise bullet points for admissions staff evaluating applications."
}

--- PAGE TEXT ---
${pageText}`;

    const response = await client.messages.create({
      model: AUTOFILL_MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const result = JSON.parse(stripFences(response.content[0].text));

    // Ensure all expected fields are present
    const { title = '', description = '', requirements = '', hidden_criteria = '' } = result;
    return res.json({ title, description, requirements, hidden_criteria });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/degrees', async (req, res) => {
  try {
    const courseName = req.body.course_name || req.body.title;
    const department = req.body.department || null;
    const durationYears = req.body.duration_years;
    const publicDescription = req.body.public_description || req.body.description;
    const publicRequirements = req.body.public_requirements || req.body.requirements || null;
    const hiddenCriteria = req.body.hidden_criteria;
    const requiredFiles = normalizeRequiredFiles(req.body.required_files);

    if (!courseName || !publicDescription || !hiddenCriteria) {
      return res.status(400).json({ error: 'course_name, public_description, and hidden_criteria are required' });
    }

    const result = await query(
      `INSERT INTO degree_listings (
         university_id, course_name, department, duration_years,
         public_description, public_requirements, hidden_criteria, required_files
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, university_id, course_name, department, duration_years,
                 public_description, public_requirements, hidden_criteria, required_files, created_at`,
      [
        req.universityProfileId,
        courseName,
        department,
        durationYears === undefined ? null : Number(durationYears),
        publicDescription,
        publicRequirements,
        hiddenCriteria,
        requiredFiles
      ]
    );

    return res.status(201).json({ degree: mapDegreeRow(result.rows[0], true) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/degrees', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, university_id, course_name, department, duration_years,
              public_description, public_requirements, hidden_criteria, required_files, created_at
       FROM degree_listings
       WHERE university_id = $1
       ORDER BY created_at DESC`,
      [req.universityProfileId]
    );
    return res.json({ degrees: result.rows.map((row) => mapDegreeRow(row, true)) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/degrees/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, university_id, course_name, department, duration_years,
              public_description, public_requirements, hidden_criteria, required_files, created_at
       FROM degree_listings
       WHERE id = $1 AND university_id = $2`,
      [req.params.id, req.universityProfileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }

    return res.json({ degree: mapDegreeRow(result.rows[0], true) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/degrees/:id', async (req, res) => {
  try {
    const courseName = req.body.course_name || req.body.title || null;
    const department = req.body.department || null;
    const durationYears = req.body.duration_years;
    const publicDescription = req.body.public_description || req.body.description || null;
    const publicRequirements = req.body.public_requirements || req.body.requirements || null;
    const hiddenCriteria = req.body.hidden_criteria || null;
    const requiredFiles = req.body.required_files !== undefined
      ? normalizeRequiredFiles(req.body.required_files)
      : null;

    const result = await query(
      `UPDATE degree_listings
       SET course_name = COALESCE($1, course_name),
           department = COALESCE($2, department),
           duration_years = COALESCE($3, duration_years),
           public_description = COALESCE($4, public_description),
           public_requirements = COALESCE($5, public_requirements),
           hidden_criteria = COALESCE($6, hidden_criteria),
           required_files = COALESCE($7, required_files)
       WHERE id = $8 AND university_id = $9
       RETURNING id, university_id, course_name, department, duration_years,
                 public_description, public_requirements, hidden_criteria, required_files, created_at`,
      [
        courseName,
        department,
        durationYears === undefined ? null : Number(durationYears),
        publicDescription,
        publicRequirements,
        hiddenCriteria,
        requiredFiles,
        req.params.id,
        req.universityProfileId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }

    return res.json({ degree: mapDegreeRow(result.rows[0], true) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/degrees/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM degree_listings WHERE id = $1 AND university_id = $2 RETURNING id', [
      req.params.id,
      req.universityProfileId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/applications', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.degree_id, d.course_name AS degree_title,
              a.applicant_id, ap.full_name AS applicant_name, u.email AS applicant_email,
              a.status, a.ai_score, a.ai_provider, a.ai_model, a.ai_reasoning, a.submitted_at, a.scored_at
       FROM applications a
       JOIN degree_listings d ON d.id = a.degree_id
       JOIN applicants ap ON ap.id = a.applicant_id
       JOIN users u ON u.id = ap.user_id
       WHERE d.university_id = $1
       ORDER BY a.submitted_at DESC`,
      [req.universityProfileId]
    );

    return res.json({ applications: result.rows });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/applications/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.degree_id, d.course_name AS degree_title,
              a.applicant_id, ap.full_name AS applicant_name, u.email AS applicant_email,
              a.personal_statement_path, a.transcript_path, a.cv_path,
              a.status, a.ai_score, a.ai_provider, a.ai_model, a.ai_reasoning, a.ai_full_result, a.ai_pass1_extraction,
              a.submitted_at, a.scored_at
       FROM applications a
       JOIN degree_listings d ON d.id = a.degree_id
       JOIN applicants ap ON ap.id = a.applicant_id
       JOIN users u ON u.id = ap.user_id
       WHERE a.id = $1 AND d.university_id = $2`,
      [req.params.id, req.universityProfileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    return res.json({ application: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
