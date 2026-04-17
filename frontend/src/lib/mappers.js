function nonEmpty(value) {
  return value !== undefined && value !== null && value !== '';
}

const ALL_FILES = ['personal_statement', 'transcript', 'cv'];

function normalizeRequiredFiles(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value.filter((f) => ALL_FILES.includes(f));
  }
  return ALL_FILES;
}

export function mapDegreeForView(degree = {}) {
  return {
    id: degree.id,
    title: degree.course_name ?? degree.title ?? '',
    description: degree.public_description ?? degree.description ?? '',
    requirements: degree.public_requirements ?? degree.requirements ?? '',
    hidden_criteria: degree.hidden_criteria ?? '',
    required_files: normalizeRequiredFiles(degree.required_files),
    created_at: degree.created_at,
    department: degree.department ?? '',
    duration_years: degree.duration_years
  };
}

export function mapDegreeFormToPayload(form) {
  const payload = {
    course_name: form.title,
    public_description: form.description,
    hidden_criteria: form.hidden_criteria,
    required_files: normalizeRequiredFiles(form.required_files)
  };

  if (nonEmpty(form.requirements)) {
    payload.public_requirements = form.requirements;
  }

  if (nonEmpty(form.department)) {
    payload.department = form.department;
  }

  if (nonEmpty(form.duration_years)) {
    payload.duration_years = form.duration_years;
  }

  return payload;
}

export function mapApplicationInsights(application = {}) {
  const strengths = normalizeStringList(application.strengths).length
    ? normalizeStringList(application.strengths)
    : parseSectionList(application.ai_reasoning, 'Strengths:');
  const weaknesses = normalizeStringList(application.weaknesses).length
    ? normalizeStringList(application.weaknesses)
    : parseSectionList(application.ai_reasoning, 'Weaknesses:');
  const criteriaMatch = normalizeCriteriaMatch(application.criteria_match).length
    ? normalizeCriteriaMatch(application.criteria_match)
    : parseCriteriaFromReasoning(application.ai_reasoning);

  return { strengths, weaknesses, criteriaMatch };
}

function normalizeStringList(value) {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) {
    return parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  }
  return [];
}

function normalizeCriteriaMatch(value) {
  if (typeof value === 'string' && value.trim()) {
    return [{ criterion: 'Overall fit', match_level: 'Summary', evidence: value.trim() }];
  }
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      criterion: item.criterion || item.criteria || item.name || 'Criterion',
      match_level: item.match_level || item.match || item.level || 'N/A',
      evidence: item.evidence || item.reasoning || item.notes || ''
    }));
}

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function parseSectionList(reasoning, heading) {
  if (typeof reasoning !== 'string') return [];
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = reasoning.match(new RegExp(`${escapedHeading}\\s*([^\\n]+)`));
  if (!match || !match[1]) return [];
  return match[1]
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCriteriaFromReasoning(reasoning) {
  if (typeof reasoning !== 'string') return [];
  const match = reasoning.match(/Criteria Match:\s*([^\n]+)/);
  if (!match || !match[1]) return [];
  return [{ criterion: 'Overall fit', match_level: 'Summary', evidence: match[1].trim() }];
}
