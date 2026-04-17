ALTER TABLE degree_listings ADD COLUMN IF NOT EXISTS required_files TEXT[] NOT NULL DEFAULT ARRAY['personal_statement', 'transcript', 'cv'];

CREATE TABLE IF NOT EXISTS manual_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  personal_statement_path TEXT,
  transcript_path TEXT,
  cv_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES manual_candidates(id) ON DELETE CASCADE,
  degree_id UUID NOT NULL REFERENCES degree_listings(id) ON DELETE CASCADE,
  ai_score NUMERIC(4,2) CHECK (ai_score IS NULL OR (ai_score >= 1 AND ai_score <= 10)),
  ai_provider TEXT CHECK (ai_provider IS NULL OR ai_provider IN ('anthropic', 'google')),
  ai_model TEXT,
  ai_reasoning TEXT,
  ai_full_result JSONB,
  ai_pass1_extraction JSONB,
  status TEXT NOT NULL DEFAULT 'awaiting_model_selection' CHECK (
    status IN ('awaiting_model_selection', 'pending', 'scored', 'scoring_failed')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scored_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_manual_candidates_university_id ON manual_candidates(university_id);
CREATE INDEX IF NOT EXISTS idx_candidate_tests_candidate_id ON candidate_tests(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_tests_degree_id ON candidate_tests(degree_id);
