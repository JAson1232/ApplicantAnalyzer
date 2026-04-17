const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { scoreApplication, resolveModelSelection } = require('../services/aiScorer');

const router = express.Router();

router.use(authenticateToken);

async function checkOwnership(applicationId, userId) {
  const result = await query(
    `SELECT a.id
     FROM applications a
     JOIN degree_listings d ON d.id = a.degree_id
     JOIN universities u ON u.id = d.university_id
     WHERE a.id = $1 AND u.user_id = $2`,
    [applicationId, userId]
  );
  return result.rows.length > 0;
}

// POST /:applicationId or /applications/:applicationId/trigger
// Queues a rescore and returns immediately — scoring runs in background
async function triggerHandler(req, res) {
  if (req.user.role === 'applicant') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const appId = req.params.applicationId;
  if (!appId) {
    return res.status(400).json({ error: 'Invalid applicationId' });
  }

  const selectedProvider = req.body?.provider;
  let modelSelection;
  try {
    modelSelection = resolveModelSelection({ provider: selectedProvider });
  } catch (error) {
    const isProviderConfigError = /_API_KEY/.test(error.message);
    return res.status(isProviderConfigError ? 500 : 400).json({ error: error.message });
  }

  const owned = await checkOwnership(appId, req.user.id);
  if (!owned) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const current = await query(`SELECT status FROM applications WHERE id = $1`, [appId]);
  if (current.rows[0]?.status === 'pending') {
    return res.status(409).json({ error: 'Scoring is already pending. Cancel it first, then requeue.' });
  }

  // Mark as pending immediately so the frontend can see it's in progress
  await query(
    `UPDATE applications
     SET status = 'pending',
         ai_score = NULL,
         ai_reasoning = NULL,
         ai_full_result = NULL,
         ai_pass1_extraction = NULL,
         ai_provider = $2,
         ai_model = $3,
         scored_at = NULL
     WHERE id = $1`,
    [appId, modelSelection.provider, modelSelection.model]
  );

  // Fire scoring in the background — do not await
  scoreApplication(appId, { force: true, provider: modelSelection.provider, model: modelSelection.model }).catch((err) => {
    console.error(`Background scoring failed for application ${appId}:`, err.message);
  });

  return res.status(202).json({ queued: true, provider: modelSelection.provider, model: modelSelection.model });
}

async function cancelHandler(req, res) {
  if (req.user.role === 'applicant') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const appId = req.params.applicationId;
  if (!appId) {
    return res.status(400).json({ error: 'Invalid applicationId' });
  }

  const owned = await checkOwnership(appId, req.user.id);
  if (!owned) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const result = await query(
    `UPDATE applications
     SET status = 'awaiting_model_selection',
         ai_score = NULL,
         ai_reasoning = NULL,
         ai_full_result = NULL,
         ai_pass1_extraction = NULL,
         scored_at = NULL
     WHERE id = $1 AND status = 'pending'
     RETURNING id`,
    [appId]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'Only pending scoring requests can be cancelled.' });
  }

  return res.json({ cancelled: true });
}

// GET /:applicationId/status — lightweight poll endpoint
router.get('/:applicationId/status', async (req, res) => {
  if (req.user.role === 'applicant') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const appId = req.params.applicationId;
  const owned = await checkOwnership(appId, req.user.id);
  if (!owned) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const result = await query(
    `SELECT status, ai_score, ai_provider, ai_model, scored_at FROM applications WHERE id = $1`,
    [appId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Application not found' });
  }

  return res.json(result.rows[0]);
});

router.post('/:applicationId', triggerHandler);
router.post('/applications/:applicationId/trigger', triggerHandler);
router.post('/:applicationId/cancel', cancelHandler);
router.post('/applications/:applicationId/cancel', cancelHandler);

module.exports = router;
