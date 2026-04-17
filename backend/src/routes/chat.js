const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { rescoreFromExtraction } = require('../services/aiScorer');

const router = express.Router();
router.use(authenticateToken);

const MODEL = 'claude-sonnet-4-20250514';

const TOOLS = [
  {
    name: 'update_extraction_field',
    description:
      'Correct a specific field in the extracted application data using a dot-notation path. ' +
      'This patches only the targeted field — all other data is preserved. ' +
      'Examples: "transcript.subjects.2.grade" to fix a subject grade, ' +
      '"cv.technical_skills" to replace the skills array, ' +
      '"transcript.overall_gpa_or_grade" to fix the overall grade.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Dot-notation path to the field. Use numeric indices for arrays (e.g. transcript.subjects.2.grade)'
        },
        value: {
          description: 'The correct value to set at this path'
        }
      },
      required: ['path', 'value']
    }
  },
  {
    name: 'trigger_rescore',
    description:
      'Re-run the AI evaluation (Pass 2 scoring only) using the current extracted data, including any corrections just made. ' +
      'Always call this after update_extraction_field if the user wants an updated score.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

function buildSystemPrompt(app) {
  const result = app.ai_full_result;
  const extraction = app.ai_pass1_extraction;

  return `You are an expert admissions assistant helping a university admissions officer evaluate a specific applicant. You have full access to the AI-generated assessment and the structured data extracted from the applicant's documents.

Be concise, direct, and specific. Always cite details from the documents or assessment when answering.

You have two tools available:
- update_extraction_field: correct a specific field using a dot-notation path (e.g. "transcript.subjects.2.grade"). Only the targeted field is changed — all other data is preserved.
- trigger_rescore: re-run the AI evaluation after corrections are saved.

When a user points out an error in the extracted data, follow this exact flow:
1. FIRST respond in plain text describing the exact field path and the change you will make (e.g. "I will set transcript.subjects.2.grade from 6.8 to 8.0"). Ask the user to confirm before proceeding.
2. Do NOT call any tools yet.
3. Only call update_extraction_field followed by trigger_rescore AFTER the user explicitly confirms (e.g. "yes", "go ahead", "correct", "confirm").
4. After the tools complete, summarise what was changed and what the new score is.

Never call tools without explicit user confirmation first.

Do NOT reveal the hidden admissions criteria verbatim.

━━━ APPLICATION OVERVIEW ━━━
Applicant: ${app.applicant_name}
Degree: ${app.degree_title}
University: ${app.university_name}
Department: ${app.department || 'N/A'}
AI Score: ${app.ai_score ?? 'Not yet scored'}/10
${result ? `Recommendation: ${result.recommendation ?? 'N/A'}\nScore label: ${result.score_label ?? 'N/A'}` : ''}

━━━ AI EVALUATION ━━━
${result ? JSON.stringify(result, null, 2) : 'Not available yet.'}

━━━ DOCUMENT EXTRACTION ━━━
${extraction ? JSON.stringify(extraction, null, 2) : 'Not available yet.'}`;
}

async function fetchApp(applicationId, userId) {
  const result = await query(
    `SELECT a.id, a.ai_score, a.ai_full_result, a.ai_pass1_extraction, a.status,
            ap.full_name AS applicant_name,
            d.course_name AS degree_title, d.department,
            u.university_name
     FROM applications a
     JOIN degree_listings d ON d.id = a.degree_id
     JOIN universities u ON u.id = d.university_id
     JOIN applicants ap ON ap.id = a.applicant_id
     WHERE a.id = $1 AND u.user_id = $2`,
    [applicationId, userId]
  );
  return result.rows[0] ?? null;
}

function setAtPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  const result = JSON.parse(JSON.stringify(obj)); // deep clone — never mutate original
  let cursor = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? parseInt(parts[i], 10) : parts[i];
    if (cursor[key] === undefined || cursor[key] === null) {
      throw new Error(`Path segment "${parts.slice(0, i + 1).join('.')}" does not exist`);
    }
    cursor = cursor[key];
  }
  const lastKey = /^\d+$/.test(parts[parts.length - 1])
    ? parseInt(parts[parts.length - 1], 10)
    : parts[parts.length - 1];
  cursor[lastKey] = value;
  return result;
}

async function executeTool(name, input, applicationId) {
  if (name === 'update_extraction_field') {
    const { path, value } = input;
    const current = await query(
      'SELECT ai_pass1_extraction FROM applications WHERE id = $1',
      [applicationId]
    );
    const extraction = current.rows[0]?.ai_pass1_extraction ?? {};
    const updated = setAtPath(extraction, path, value);
    await query(
      'UPDATE applications SET ai_pass1_extraction = $2 WHERE id = $1',
      [applicationId, JSON.stringify(updated)]
    );
    return { success: true, message: `Set ${path} = ${JSON.stringify(value)}` };
  }

  if (name === 'trigger_rescore') {
    const result = await rescoreFromExtraction(applicationId);
    return {
      success: true,
      new_score: result.final_score,
      recommendation: result.recommendation,
      score_label: result.score_label
    };
  }

  return { error: `Unknown tool: ${name}` };
}

// Agentic loop: call Claude, execute any tools, repeat until end_turn
async function runAgenticLoop(client, systemPrompt, messages, applicationId) {
  let current = messages.map((m) => ({ role: m.role, content: m.content }));

  for (let i = 0; i < 10; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages: current
    });

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');

    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
      const text = response.content.find((b) => b.type === 'text')?.text ?? '';
      return text;
    }

    // Execute tool calls sequentially — order matters (update must commit before rescore reads)
    const toolResults = [];
    for (const block of toolUseBlocks) {
      const result = await executeTool(block.name, block.input, applicationId);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result)
      });
    }

    current = [
      ...current,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults }
    ];
  }

  return 'I was unable to complete the action after several attempts. Please try again.';
}

router.post('/applications/:applicationId', async (req, res) => {
  try {
    if (req.user.role !== 'university') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { applicationId } = req.params;
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const app = await fetchApp(applicationId, req.user.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
    }

    const client = new Anthropic();

    // Rebuild system prompt from DB so it reflects any prior corrections
    const systemPrompt = buildSystemPrompt(app);
    const reply = await runAgenticLoop(client, systemPrompt, messages, applicationId);

    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
