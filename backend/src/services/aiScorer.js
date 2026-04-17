const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { query } = require('../db');

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-3.1-flash-lite-preview'
};
const PASS1_MAX_TOKENS = 4000;
const PASS2_MAX_TOKENS = 4000;
const SUGGESTIONS_MAX_TOKENS = 2000;
const SCORING_TIMEOUT_MS = 120_000;
const SUGGESTIONS_TIMEOUT_MS = 60_000;
const SHORT_DOC_THRESHOLD = 100;

function resolveModelSelection({ provider, model } = {}) {
  const normalizedProvider = String(provider || 'anthropic').trim().toLowerCase();
  if (!DEFAULT_MODELS[normalizedProvider]) {
    throw new Error('provider must be one of: anthropic, google');
  }

  const resolvedModel = model || DEFAULT_MODELS[normalizedProvider];
  if (!resolvedModel) {
    throw new Error('No model configured for provider ' + normalizedProvider);
  }

  if (normalizedProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required for Anthropic scoring');
  }
  if (normalizedProvider === 'google' && !process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for Google Gemini scoring');
  }

  return { provider: normalizedProvider, model: resolvedModel };
}

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required');
  return new Anthropic();
}

async function callAnthropic({ model, prompt, maxTokens }) {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0]?.text || '';
}

async function callGemini({ model, prompt, maxTokens }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 }
      })
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${message}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || '').join('').trim();
  if (!text) {
    throw new Error('Gemini returned an empty response');
  }
  return text;
}

async function generateModelText(selection, prompt, maxTokens) {
  if (selection.provider === 'anthropic') {
    return callAnthropic({ model: selection.model, prompt, maxTokens });
  }
  if (selection.provider === 'google') {
    return callGemini({ model: selection.model, prompt, maxTokens });
  }
  throw new Error(`Unsupported provider: ${selection.provider}`);
}

async function extractText(pdfPath) {
  try {
    const buffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    console.warn(`PDF extraction warning for ${pdfPath}: ${err.message}`);
    return '[Document could not be parsed — text extraction failed]';
  }
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stripJsonFences(text) {
  return text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
}

async function parseJsonWithRetry(selection, raw, retryPrompt) {
  const clean = stripJsonFences(raw);
  try {
    return JSON.parse(clean);
  } catch {
    const retryRaw = await generateModelText(selection, retryPrompt + '\n\nInvalid output was:\n' + raw, 500);
    const retryClean = stripJsonFences(retryRaw);
    return JSON.parse(retryClean);
  }
}

function buildPass1Prompt(psText, transcriptText, cvText) {
  const docUnavailable = '[Document not required for this programme — not collected]';
  const psSection = psText === docUnavailable
    ? `--- PERSONAL STATEMENT ---\n${docUnavailable}`
    : `--- PERSONAL STATEMENT (raw text) ---\n${psText}`;
  const transcriptSection = transcriptText === docUnavailable
    ? `--- ACADEMIC TRANSCRIPT ---\n${docUnavailable}`
    : `--- ACADEMIC TRANSCRIPT (raw text) ---\n${transcriptText}`;
  const cvSection = cvText === docUnavailable
    ? `--- CV / RESUME ---\n${docUnavailable}`
    : `--- CV / RESUME (raw text) ---\n${cvText}`;

  return `You are a document parser for a university admissions system. You will receive raw text extracted from applicant documents. Some documents may be marked as "not required" — for those, set all fields to null.

Your job is to parse and structure the information — do not evaluate or score yet.

Extract as much structured information as possible. If information is missing or unclear, use null. Do not invent information.

${psSection}

${transcriptSection}

${cvSection}

Return ONLY a valid JSON object with this exact schema:

{
  "personal_statement": {
    "word_count": number,
    "stated_motivation": "Why the applicant says they want to do this degree",
    "relevant_experiences_mentioned": ["list of experiences they reference"],
    "academic_interests_mentioned": ["list of academic topics they mention"],
    "career_goals_stated": "What career/life goals they mention",
    "maturity_of_writing": "elementary | developing | competent | sophisticated",
    "self_awareness_signals": "Any evidence of genuine self-reflection or lack thereof",
    "red_flags": ["Any concerns: vague writing, no specifics, copied-sounding prose, etc."],
    "standout_moments": ["Any genuinely impressive or memorable specific points"]
  },
  "transcript": {
    "institution_name": "string or null",
    "qualification_type": "A-Levels | IB | Bachelor | Other | null",
    "overall_gpa_or_grade": "string or null",
    "subjects": [
      {
        "subject_name": "string",
        "grade": "string",
        "level": "standard | higher | advanced | honours | null",
        "relevance_to_stem": "high | medium | low | none"
      }
    ],
    "grade_trend": "improving | stable | declining | mixed | unclear",
    "strongest_subjects": ["list"],
    "weakest_subjects": ["list"],
    "notable_achievements": ["prizes, distinctions, scholarships etc."],
    "red_flags": ["failures, repeated years, unexplained gaps, sudden grade drops"]
  },
  "cv": {
    "total_work_experience_months": number or null,
    "work_experiences": [
      {
        "role": "string",
        "organisation": "string",
        "duration_months": number or null,
        "type": "internship | part_time | full_time | volunteer | research | other",
        "relevance_to_degree": "high | medium | low | none",
        "description_summary": "string"
      }
    ],
    "extracurriculars": [
      {
        "activity": "string",
        "role": "participant | leader | founder | other",
        "relevance_to_degree": "high | medium | low | none"
      }
    ],
    "technical_skills": ["list of explicitly mentioned tools, languages, software, methods"],
    "languages": ["list"],
    "publications_or_projects": ["any research, papers, notable projects"],
    "awards_and_honours": ["list"],
    "red_flags": ["unexplained gaps, very sparse CV for age, inconsistencies with other docs"]
  },
  "cross_document_signals": {
    "consistency_score": "high | medium | low",
    "consistency_notes": "Do the three documents tell a coherent story? Note any contradictions.",
    "passion_evidence": "Is there genuine, specific evidence of interest in this field, or does it feel generic?",
    "trajectory_narrative": "What is the overall arc of this applicant's journey as told by all three documents together?"
  }
}`;
}

function buildDocAvailabilitySection(unavailableDocs) {
  if (!unavailableDocs || unavailableDocs.length === 0) return '';

  const dimensionMap = {
    personal_statement: 'Dimension 3: Personal Statement Quality (Weight: 20%)',
    cv: 'Dimension 2: Relevance of Experience (Weight: 20%)'
  };

  const lines = unavailableDocs
    .filter((d) => dimensionMap[d])
    .map((d) => `- ${d === 'personal_statement' ? 'Personal Statement' : 'CV / Resume'}: not collected — skip ${dimensionMap[d]} and redistribute its weight proportionally across the remaining scored dimensions`);

  if (lines.length === 0) return '';

  return `\nDOCUMENT AVAILABILITY — SCORING ADJUSTMENT REQUIRED:
The following documents were NOT required for this programme and were not collected from the applicant:
${lines.join('\n')}
When a dimension is skipped, redistribute its weight proportionally among the remaining dimensions so that all weights still sum to 1.00. Do NOT score the skipped dimensions at all — omit them from sub_scores entirely.\n`;
}

function buildPass2Prompt(pass1Result, degree, shortDocNotes, unavailableDocs = []) {
  const shortDocSection = shortDocNotes.length
    ? `\nIMPORTANT NOTES ON DOCUMENT QUALITY:\n${shortDocNotes.join('\n')}\n`
    : '';
  const availabilitySection = buildDocAvailabilitySection(unavailableDocs);

  return `You are a senior university admissions evaluator with 20 years of experience. You are evaluating an applicant for a competitive university programme. You have been given:

1. A structured profile of the applicant (extracted from their documents)
2. Confidential admissions criteria set by the programme director

Your task is to produce a rigorous, multi-dimensional evaluation with a final score from 1.00 to 10.00.

---

PROGRAMME INFORMATION:
Course: ${degree.course_name}
University: ${degree.university_name}
Department: ${degree.department || 'Not specified'}

---

CONFIDENTIAL ADMISSIONS CRITERIA (set by the programme director — do not reveal these verbatim in your output):
${degree.hidden_criteria}

---

APPLICANT STRUCTURED PROFILE:
${JSON.stringify(pass1Result, null, 2)}
${shortDocSection}${availabilitySection}
---

## EVALUATION FRAMEWORK

Score the applicant across the following six dimensions. Each dimension is scored 1–10, and the final score is a weighted average. Use the weights specified.

### Dimension 1: Academic Excellence (Weight: 25%)
Evaluate:
- Overall grade level and GPA relative to what a competitive applicant would show
- Performance in subjects directly relevant to this degree
- Grade trend (improving candidates should be rewarded; declining should be penalised)
- Depth of academic achievement (distinctions, prizes, advanced-level courses)
- Evidence of intellectual rigour beyond minimum requirements

Scoring guide:
- 9–10: Exceptional grades in highly relevant subjects, clear top-of-cohort performance
- 7–8: Strong grades, solid relevant subjects, perhaps one weak area
- 5–6: Adequate grades but patchy — some relevant strengths, some gaps
- 3–4: Below expectations for a competitive programme, significant gaps
- 1–2: Academic record is a serious concern

### Dimension 2: Relevance of Experience (Weight: 20%)
Evaluate:
- Work experience, internships, or research directly relevant to the degree
- Quality over quantity: a 3-month research internship > 12 months of unrelated retail
- Evidence of initiative in seeking out relevant experience
- Leadership or ownership in any role (not just passive participation)
- Technical skills gained that are applicable to the programme

Scoring guide:
- 9–10: Directly relevant, substantive experience that most applicants their age would not have
- 7–8: Good relevant experience, shows initiative
- 5–6: Some relevant experience but mostly generic or very junior
- 3–4: Little to no relevant experience; mostly unrelated roles
- 1–2: No meaningful work experience or heavily misleading

### Dimension 3: Personal Statement Quality (Weight: 20%)
Evaluate:
- Specificity: Does the statement cite specific experiences, papers, projects, professors, or concepts? Generic statements score low.
- Motivation: Is the drive to study this subject credible and compelling?
- Maturity: Does the applicant show genuine self-awareness and intellectual development?
- Narrative arc: Does it tell a coherent story leading to this application?
- Writing quality: Clarity, structure, and sophistication of expression
- Absence of red flags: Plagiarism-sounding prose, vague generalities, no personal voice

Scoring guide:
- 9–10: Vivid, specific, convincing, mature — a statement that stands out
- 7–8: Solid and genuine, specific enough, good writing
- 5–6: Adequate but generic — could apply to any university or course
- 3–4: Vague, unfocused, or raises doubts about genuine interest
- 1–2: Very poor quality, seemingly copy-pasted, or deeply unconvincing

### Dimension 4: Hidden Criteria Match (Weight: 25%)
This is the most important dimension after academic excellence. The programme director has specified particular signals they value. Evaluate how well the applicant's profile matches those criteria.

For each criterion in the hidden criteria list:
- Determine if the applicant's documents provide STRONG, WEAK, or NO evidence of meeting it
- Consider indirect signals (e.g. if the criterion is "experience with data" and the CV lists Python and a data science internship, that is strong evidence even if the word "data" is not in the statement)
- Do not penalise for criteria the applicant could not reasonably have known about
- Do not reveal the specific criteria in your output — describe the match abstractly

Scoring guide:
- 9–10: Meets nearly all hidden criteria with strong, specific evidence
- 7–8: Meets most criteria; minor gaps
- 5–6: Meets some criteria; clear gaps on others
- 3–4: Meets few criteria; mostly mismatched profile
- 1–2: Profile is almost entirely misaligned with what this programme seeks

### Dimension 5: Intellectual Potential & Trajectory (Weight: 5%)
This is the "ceiling" dimension — not where the applicant is now, but where they could go.
Evaluate:
- Evidence of self-directed learning (books read, online courses, personal projects)
- Curiosity signals in the personal statement (questions asked, not just answers given)
- Rate of development: is this person getting better fast?
- Any extraordinary signal that suggests unusual talent or drive

Scoring guide:
- 9–10: Exceptional signs of self-directed intellectual growth
- 5–6: Normal trajectory, no particular signals either way
- 1–2: No evidence of curiosity or initiative beyond what is required

### Dimension 6: Document Consistency & Integrity (Weight: 5%)
Evaluate:
- Do the three documents tell a coherent, consistent story?
- Are dates, roles, and achievements consistent across documents?
- Does the personal statement reference real things from the CV and transcript?
- Are there any suspicious inconsistencies that might suggest embellishment?

Scoring guide:
- 9–10: Perfectly consistent, mutually reinforcing documents
- 7–8: Minor inconsistencies, nothing concerning
- 5–6: Some gaps in consistency
- 3–4: Noticeable contradictions across documents
- 1–2: Serious inconsistencies that raise integrity concerns

---

## SCORING CALCULATION

Compute the final score as:

final_score = (
  (academic_excellence * 0.25) +
  (relevance_of_experience * 0.20) +
  (personal_statement_quality * 0.20) +
  (hidden_criteria_match * 0.25) +
  (intellectual_potential * 0.05) +
  (document_consistency * 0.05)
)

Round to 2 decimal places.

---

## OUTPUT FORMAT

Respond ONLY with a valid JSON object. No preamble. No explanation outside the JSON.

{
  "final_score": 7.45,
  "score_label": "Strong Applicant | Promising | Average | Below Average | Weak",
  "recommendation": "Admit | Admit with Interview | Waitlist | Reject",
  "sub_scores": {
    "academic_excellence": { "score": 8.0, "reasoning": "..." },
    "relevance_of_experience": { "score": 7.5, "reasoning": "..." },
    "personal_statement_quality": { "score": 6.5, "reasoning": "..." },
    "hidden_criteria_match": { "score": 8.0, "reasoning": "Describe match quality without revealing the criteria themselves" },
    "intellectual_potential": { "score": 7.0, "reasoning": "..." },
    "document_consistency": { "score": 9.0, "reasoning": "..." }
  },
  "strengths": [
    "Specific strength 1 with evidence from documents",
    "Specific strength 2 with evidence from documents",
    "Specific strength 3 with evidence from documents"
  ],
  "weaknesses": [
    "Specific weakness 1 with suggested context",
    "Specific weakness 2"
  ],
  "red_flags": [
    "Any serious concerns — inconsistencies, implausible claims, etc. Empty array if none."
  ],
  "standout_moments": [
    "Any specific detail from the documents that was genuinely impressive or memorable"
  ],
  "evaluator_summary": "A 3–4 paragraph narrative written in the voice of a senior admissions officer. Should be specific, reference actual details from the documents, and give the university reader a clear picture of who this person is and why they scored as they did. Do NOT be generic. Mention specific subjects, roles, or moments from their documents.",
  "interview_questions": [
    "If the applicant were interviewed, what 3 questions would you want answered to resolve any uncertainty?",
    "Question 2",
    "Question 3"
  ],
  "comparable_profile": "In one sentence, describe the archetype of applicant this person resembles (e.g. 'A technically strong self-taught programmer with limited formal research experience but high ceiling')"
}`;
}

function runWithTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Scoring timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const DOC_NOT_REQUIRED = '[Document not required for this programme — not collected]';
const ALL_FILE_KEYS = ['personal_statement', 'transcript', 'cv'];

function normalizeRequiredFiles(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value.filter((f) => ALL_FILE_KEYS.includes(f));
  }
  return ALL_FILE_KEYS;
}

async function scoreApplication(applicationId, options = {}) {
  const appResult = await query(
    `SELECT a.id, a.degree_id, a.applicant_id,
            a.personal_statement_path, a.transcript_path, a.cv_path,
            a.status, a.ai_provider, a.ai_model,
            d.course_name, d.department, d.duration_years,
            d.public_description, d.public_requirements, d.hidden_criteria, d.required_files,
            u.university_name
     FROM applications a
     JOIN degree_listings d ON d.id = a.degree_id
     JOIN universities u ON u.id = d.university_id
     WHERE a.id = $1`,
    [applicationId]
  );

  if (appResult.rows.length === 0) throw new Error('Application not found');
  const app = appResult.rows[0];
  const selection = resolveModelSelection({
    provider: options.provider || app.ai_provider,
    model: options.model || app.ai_model
  });

  if (app.status === 'scored' && !options.force) {
    return { skipped: true, reason: 'Application already scored' };
  }

  const requiredFiles = normalizeRequiredFiles(app.required_files);
  if (!app.hidden_criteria) throw new Error('Cannot score without hidden criteria');

  // Validate that all required files are present
  const missingRequired = requiredFiles.filter((field) => {
    if (field === 'personal_statement') return !app.personal_statement_path;
    if (field === 'transcript') return !app.transcript_path;
    if (field === 'cv') return !app.cv_path;
    return false;
  });
  if (missingRequired.length > 0) {
    throw new Error(`Application is missing required documents: ${missingRequired.join(', ')}`);
  }

  const storagePrefix = process.env.UPLOAD_DIR || '/app/uploads';
  const toFilesystemPath = (p) => p.replace(/^\/uploads/, storagePrefix);

  const pipeline = async () => {
    console.log(`[scorer] starting pipeline for application ${applicationId}`);
    console.log(`[scorer] scoring with ${selection.provider}/${selection.model}`);
    console.log(`[scorer] required files: ${requiredFiles.join(', ')}`);

    // 1. Extract text from available PDFs; substitute placeholder for optional missing docs
    const unavailableDocs = ALL_FILE_KEYS.filter((f) => !requiredFiles.includes(f));
    const getDocText = (field, path) =>
      requiredFiles.includes(field) && path
        ? extractText(toFilesystemPath(path))
        : Promise.resolve(DOC_NOT_REQUIRED);

    const [psText, transcriptText, cvText] = await Promise.all([
      getDocText('personal_statement', app.personal_statement_path),
      getDocText('transcript', app.transcript_path),
      getDocText('cv', app.cv_path)
    ]);

    // 2. Flag short or unreadable documents (only for required docs)
    const shortDocNotes = [];
    for (const [name, text, field] of [
      ['personal statement', psText, 'personal_statement'],
      ['transcript', transcriptText, 'transcript'],
      ['CV', cvText, 'cv']
    ]) {
      if (requiredFiles.includes(field) && wordCount(text) < SHORT_DOC_THRESHOLD) {
        shortDocNotes.push(
          `Note: the ${name} appears to be very short or partially extracted. Factor this uncertainty into your evaluation.`
        );
      }
    }

    // 3. Pass 1 — structured document extraction
    console.log(`[scorer] starting Pass 1 (extraction)`);
    const pass1Response = await generateModelText(selection, buildPass1Prompt(psText, transcriptText, cvText), PASS1_MAX_TOKENS);
    const pass1Result = await parseJsonWithRetry(
      selection,
      pass1Response,
      'The following was supposed to be a valid JSON object for document extraction but had a parse error. Return ONLY the corrected JSON, no explanation.'
    );

    // 4. Pass 2 — evaluation and scoring
    console.log(`[scorer] Pass 1 complete, starting Pass 2 (evaluation)`);
    const pass2Response = await generateModelText(
      selection,
      buildPass2Prompt(pass1Result, app, shortDocNotes, unavailableDocs),
      PASS2_MAX_TOKENS
    );
    const pass2Result = await parseJsonWithRetry(
      selection,
      pass2Response,
      'The following was supposed to be a valid JSON evaluation result but had a parse error. Return ONLY the corrected JSON, no explanation.'
    );

    // 5. Validate and clamp final score
    let finalScore = Number(pass2Result.final_score);
    if (Number.isNaN(finalScore)) throw new Error('Model returned invalid final_score');
    if (finalScore < 1 || finalScore > 10) {
      console.warn(`Score ${finalScore} out of range [1, 10] — clamping`);
      finalScore = Math.max(1, Math.min(10, finalScore));
    }
    pass2Result.final_score = Number(finalScore.toFixed(2));

    return { pass1Result, pass2Result };
  };

  try {
    const { pass1Result, pass2Result } = await runWithTimeout(pipeline(), SCORING_TIMEOUT_MS);
    console.log(`[scorer] pipeline complete, final score: ${pass2Result.final_score}`);

    const successUpdate = await query(
      `UPDATE applications
       SET ai_score            = $2,
            ai_reasoning        = $3,
            ai_full_result      = $4,
            ai_pass1_extraction = $5,
            ai_provider         = $6,
            ai_model            = $7,
            status              = 'scored',
            scored_at           = NOW()
        WHERE id = $1 AND status = 'pending'`,
      [
        applicationId,
        pass2Result.final_score,
        pass2Result.evaluator_summary,
        JSON.stringify(pass2Result),
        JSON.stringify(pass1Result),
        selection.provider,
        selection.model
      ]
    );

    if (successUpdate.rowCount === 0) {
      return { skipped: true, reason: 'Scoring was cancelled before completion' };
    }

    return { skipped: false, ...pass2Result };
  } catch (error) {
    const failUpdate = await query(
      `UPDATE applications
       SET status = 'scoring_failed', ai_reasoning = $2
       WHERE id = $1 AND status = 'pending'`,
      [applicationId, 'Scoring failed: ' + error.message]
    );
    if (failUpdate.rowCount === 0) {
      return { skipped: true, reason: 'Scoring was cancelled before failure handling' };
    }
    throw error;
  }
}

// Re-runs only Pass 2 using the existing (possibly corrected) ai_pass1_extraction.
// Does NOT re-extract from PDFs, so manual corrections are preserved.
async function rescoreFromExtraction(applicationId) {
  const appResult = await query(
    `SELECT a.id, a.ai_pass1_extraction, a.ai_provider, a.ai_model,
            d.course_name, d.department, d.hidden_criteria,
            u.university_name
     FROM applications a
     JOIN degree_listings d ON d.id = a.degree_id
     JOIN universities u ON u.id = d.university_id
     WHERE a.id = $1`,
    [applicationId]
  );

  if (appResult.rows.length === 0) throw new Error('Application not found');
  const app = appResult.rows[0];

  if (!app.ai_pass1_extraction) throw new Error('No extraction data found — run a full score first');
  if (!app.hidden_criteria) throw new Error('Cannot score without hidden criteria');

  const selection = resolveModelSelection({ provider: app.ai_provider, model: app.ai_model });
  console.log(`[scorer] rescoreFromExtraction starting for ${applicationId} with ${selection.provider}/${selection.model}`);

  const pass2Response = await generateModelText(
    selection,
    buildPass2Prompt(app.ai_pass1_extraction, app, []),
    PASS2_MAX_TOKENS
  );

  const pass2Result = await parseJsonWithRetry(
    selection,
    pass2Response,
    'The following was supposed to be a valid JSON evaluation result but had a parse error. Return ONLY the corrected JSON, no explanation.'
  );

  let finalScore = Number(pass2Result.final_score);
  if (Number.isNaN(finalScore)) throw new Error('Model returned invalid final_score');
  if (finalScore < 1 || finalScore > 10) {
    finalScore = Math.max(1, Math.min(10, finalScore));
  }
  pass2Result.final_score = Number(finalScore.toFixed(2));

  await query(
    `UPDATE applications
     SET ai_score     = $2,
          ai_reasoning = $3,
          ai_full_result = $4,
          ai_provider = $5,
          ai_model = $6,
          status       = 'scored',
          scored_at    = NOW()
      WHERE id = $1`,
    [
      applicationId,
      pass2Result.final_score,
      pass2Result.evaluator_summary,
      JSON.stringify(pass2Result),
      selection.provider,
      selection.model
    ]
  );

  console.log(`[scorer] rescoreFromExtraction complete, new score: ${pass2Result.final_score}`);
  return pass2Result;
}

async function scoreCandidateTest(testId, options = {}) {
  const testResult = await query(
    `SELECT ct.id, ct.candidate_id, ct.degree_id,
            ct.status, ct.ai_provider, ct.ai_model,
            mc.personal_statement_path, mc.transcript_path, mc.cv_path,
            d.course_name, d.department, d.duration_years,
            d.public_description, d.public_requirements, d.hidden_criteria, d.required_files,
            u.university_name
     FROM candidate_tests ct
     JOIN manual_candidates mc ON mc.id = ct.candidate_id
     JOIN degree_listings d ON d.id = ct.degree_id
     JOIN universities u ON u.id = d.university_id
     WHERE ct.id = $1`,
    [testId]
  );

  if (testResult.rows.length === 0) throw new Error('Candidate test not found');
  const test = testResult.rows[0];
  const selection = resolveModelSelection({
    provider: options.provider || test.ai_provider,
    model: options.model || test.ai_model
  });

  if (test.status === 'scored' && !options.force) {
    return { skipped: true, reason: 'Test already scored' };
  }

  const requiredFiles = normalizeRequiredFiles(test.required_files);
  if (!test.hidden_criteria) throw new Error('Cannot score without hidden criteria');

  const missingRequired = requiredFiles.filter((field) => {
    if (field === 'personal_statement') return !test.personal_statement_path;
    if (field === 'transcript') return !test.transcript_path;
    if (field === 'cv') return !test.cv_path;
    return false;
  });
  if (missingRequired.length > 0) {
    throw new Error(`Candidate is missing required documents: ${missingRequired.join(', ')}`);
  }

  const storagePrefix = process.env.UPLOAD_DIR || '/app/uploads';
  const toFilesystemPath = (p) => p.replace(/^\/uploads/, storagePrefix);

  const pipeline = async () => {
    console.log(`[scorer] starting candidate test pipeline for test ${testId}`);
    console.log(`[scorer] scoring with ${selection.provider}/${selection.model}`);
    console.log(`[scorer] required files: ${requiredFiles.join(', ')}`);

    const unavailableDocs = ALL_FILE_KEYS.filter((f) => !requiredFiles.includes(f));
    const getDocText = (field, path) =>
      requiredFiles.includes(field) && path
        ? extractText(toFilesystemPath(path))
        : Promise.resolve(DOC_NOT_REQUIRED);

    const [psText, transcriptText, cvText] = await Promise.all([
      getDocText('personal_statement', test.personal_statement_path),
      getDocText('transcript', test.transcript_path),
      getDocText('cv', test.cv_path)
    ]);

    const shortDocNotes = [];
    for (const [name, text, field] of [
      ['personal statement', psText, 'personal_statement'],
      ['transcript', transcriptText, 'transcript'],
      ['CV', cvText, 'cv']
    ]) {
      if (requiredFiles.includes(field) && wordCount(text) < SHORT_DOC_THRESHOLD) {
        shortDocNotes.push(
          `Note: the ${name} appears to be very short or partially extracted. Factor this uncertainty into your evaluation.`
        );
      }
    }

    console.log(`[scorer] starting Pass 1 (extraction)`);
    const pass1Response = await generateModelText(selection, buildPass1Prompt(psText, transcriptText, cvText), PASS1_MAX_TOKENS);
    const pass1Result = await parseJsonWithRetry(
      selection,
      pass1Response,
      'The following was supposed to be a valid JSON object for document extraction but had a parse error. Return ONLY the corrected JSON, no explanation.'
    );

    console.log(`[scorer] Pass 1 complete, starting Pass 2 (evaluation)`);
    const pass2Response = await generateModelText(
      selection,
      buildPass2Prompt(pass1Result, test, shortDocNotes, unavailableDocs),
      PASS2_MAX_TOKENS
    );
    const pass2Result = await parseJsonWithRetry(
      selection,
      pass2Response,
      'The following was supposed to be a valid JSON evaluation result but had a parse error. Return ONLY the corrected JSON, no explanation.'
    );

    let finalScore = Number(pass2Result.final_score);
    if (Number.isNaN(finalScore)) throw new Error('Model returned invalid final_score');
    if (finalScore < 1 || finalScore > 10) {
      console.warn(`Score ${finalScore} out of range [1, 10] — clamping`);
      finalScore = Math.max(1, Math.min(10, finalScore));
    }
    pass2Result.final_score = Number(finalScore.toFixed(2));

    return { pass1Result, pass2Result };
  };

  try {
    const { pass1Result, pass2Result } = await runWithTimeout(pipeline(), SCORING_TIMEOUT_MS);
    console.log(`[scorer] candidate test pipeline complete, final score: ${pass2Result.final_score}`);

    const successUpdate = await query(
      `UPDATE candidate_tests
       SET ai_score            = $2,
           ai_reasoning        = $3,
           ai_full_result      = $4,
           ai_pass1_extraction = $5,
           ai_provider         = $6,
           ai_model            = $7,
           status              = 'scored',
           scored_at           = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [
        testId,
        pass2Result.final_score,
        pass2Result.evaluator_summary,
        JSON.stringify(pass2Result),
        JSON.stringify(pass1Result),
        selection.provider,
        selection.model
      ]
    );

    if (successUpdate.rowCount === 0) {
      return { skipped: true, reason: 'Test scoring was cancelled before completion' };
    }

    return { skipped: false, ...pass2Result };
  } catch (error) {
    await query(
      `UPDATE candidate_tests
       SET status = 'scoring_failed', ai_reasoning = $2
       WHERE id = $1 AND status = 'pending'`,
      [testId, 'Scoring failed: ' + error.message]
    );
    throw error;
  }
}

function buildSuggestionsPrompt(pass1Result, degree, pass2Result) {
  const subScores = pass2Result?.sub_scores;
  const scoreLines = subScores
    ? [
        subScores.academic_excellence && `- Academic Excellence: ${subScores.academic_excellence.score}/10`,
        subScores.relevance_of_experience && `- Relevance of Experience: ${subScores.relevance_of_experience.score}/10`,
        subScores.personal_statement_quality && `- Personal Statement Quality: ${subScores.personal_statement_quality.score}/10`,
        subScores.intellectual_potential && `- Intellectual Potential: ${subScores.intellectual_potential.score}/10`,
        subScores.document_consistency && `- Document Consistency: ${subScores.document_consistency.score}/10`
      ].filter(Boolean)
    : [];

  const scoreSection = scoreLines.length ? `\nCurrent assessment scores (out of 10):\n${scoreLines.join('\n')}` : '';
  const strengthSection = pass2Result?.strengths?.length
    ? `\nCurrent strengths:\n${pass2Result.strengths.map((s) => `- ${s}`).join('\n')}`
    : '';
  const weaknessSection = pass2Result?.weaknesses?.length
    ? `\nAreas for improvement:\n${pass2Result.weaknesses.map((w) => `- ${w}`).join('\n')}`
    : '';

  return `You are a helpful academic advisor giving personalised improvement suggestions to a university applicant.

You have their structured profile and the public details of the degree programme they applied to. Give specific, actionable advice on how to strengthen their profile for this or similar applications in the future.

RULES:
- Do NOT reference any confidential admissions criteria
- Be specific — avoid vague advice like "work on your grades"
- Focus on realistic, achievable improvements
- Order suggestions by impact (most impactful first)

DEGREE PROGRAMME:
Course: ${degree.course_name}
University: ${degree.university_name || 'the university'}
Department: ${degree.department || 'Not specified'}
Public Description: ${degree.public_description || 'Not provided'}
Public Requirements: ${degree.public_requirements || 'Not specified'}

APPLICANT PROFILE (extracted from their documents):
${JSON.stringify(pass1Result, null, 2)}
${scoreSection}${strengthSection}${weaknessSection}

Return ONLY valid JSON with no preamble:

{
  "overall_message": "2-3 sentence encouraging summary highlighting the 1-2 most important focus areas for this applicant",
  "suggestions": [
    {
      "category": "Academic Profile | Work Experience | Personal Statement | Skills & Projects | Extracurriculars | Document Quality",
      "priority": "high | medium | low",
      "title": "Action-oriented title under 10 words",
      "suggestion": "Specific actionable suggestion (2-4 sentences)",
      "rationale": "Why this would strengthen their application (1-2 sentences)"
    }
  ],
  "quick_wins": ["Concrete immediate action 1", "Concrete immediate action 2", "Concrete immediate action 3"]
}

Include 4-7 suggestions ordered from highest to lowest priority. Include 3-5 quick_wins.`;
}

async function generateSuggestions(applicationId) {
  const appResult = await query(
    `SELECT a.id, a.ai_pass1_extraction, a.ai_full_result, a.ai_provider, a.ai_model, a.status,
            d.course_name, d.department, d.public_description, d.public_requirements,
            u.university_name
     FROM applications a
     JOIN degree_listings d ON d.id = a.degree_id
     JOIN universities u ON u.id = d.university_id
     WHERE a.id = $1`,
    [applicationId]
  );

  if (appResult.rows.length === 0) throw new Error('Application not found');
  const app = appResult.rows[0];

  if (!['scored', 'reviewed'].includes(app.status)) {
    throw new Error('Suggestions can only be generated for scored applications');
  }
  if (!app.ai_pass1_extraction) {
    throw new Error('No extraction data found — application must be scored first');
  }

  const selection = resolveModelSelection({
    provider: app.ai_provider || 'anthropic',
    model: app.ai_model
  });

  console.log(`[suggestions] generating for application ${applicationId} with ${selection.provider}/${selection.model}`);

  const prompt = buildSuggestionsPrompt(app.ai_pass1_extraction, app, app.ai_full_result);
  const raw = await runWithTimeout(
    generateModelText(selection, prompt, SUGGESTIONS_MAX_TOKENS),
    SUGGESTIONS_TIMEOUT_MS
  );
  const suggestions = await parseJsonWithRetry(
    selection,
    raw,
    'The following was supposed to be a valid JSON object for improvement suggestions but had a parse error. Return ONLY the corrected JSON, no explanation.'
  );

  await query(`UPDATE applications SET ai_suggestions = $2 WHERE id = $1`, [
    applicationId,
    JSON.stringify(suggestions)
  ]);

  console.log(`[suggestions] generation complete for application ${applicationId}`);
  return suggestions;
}

module.exports = { scoreApplication, rescoreFromExtraction, resolveModelSelection, scoreCandidateTest, generateSuggestions };
