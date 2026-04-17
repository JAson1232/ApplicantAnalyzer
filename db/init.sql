CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('university', 'applicant')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  university_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS degree_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  department TEXT,
  duration_years INTEGER,
  public_description TEXT NOT NULL,
  public_requirements TEXT,
  hidden_criteria TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  degree_id UUID NOT NULL REFERENCES degree_listings(id) ON DELETE CASCADE,
  personal_statement_path TEXT,
  transcript_path TEXT,
  cv_path TEXT,
  ai_score NUMERIC(4,2) CHECK (ai_score IS NULL OR (ai_score >= 1 AND ai_score <= 10)),
  ai_provider TEXT CHECK (ai_provider IS NULL OR ai_provider IN ('anthropic', 'google')),
  ai_model TEXT,
  ai_reasoning TEXT,
  ai_full_result JSONB,
  ai_pass1_extraction JSONB,
  status TEXT NOT NULL DEFAULT 'awaiting_model_selection' CHECK (
    status IN ('awaiting_model_selection', 'pending', 'scored', 'reviewed', 'scoring_failed')
  ),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scored_at TIMESTAMPTZ
);

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

CREATE INDEX IF NOT EXISTS idx_universities_user_id ON universities(user_id);
CREATE INDEX IF NOT EXISTS idx_degree_listings_university_id ON degree_listings(university_id);
CREATE INDEX IF NOT EXISTS idx_applicants_user_id ON applicants(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_degree_id ON applications(degree_id);
CREATE INDEX IF NOT EXISTS idx_manual_candidates_university_id ON manual_candidates(university_id);
CREATE INDEX IF NOT EXISTS idx_candidate_tests_candidate_id ON candidate_tests(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_tests_degree_id ON candidate_tests(degree_id);

-- Migrations for existing databases (idempotent)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_full_result JSONB;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_pass1_extraction JSONB;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_provider TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_model TEXT;
ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'awaiting_model_selection';
ALTER TABLE degree_listings ADD COLUMN IF NOT EXISTS required_files TEXT[] NOT NULL DEFAULT ARRAY['personal_statement', 'transcript', 'cv'];

DO $$
BEGIN
  ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_ai_provider_check;
  ALTER TABLE applications ADD CONSTRAINT applications_ai_provider_check
    CHECK (ai_provider IS NULL OR ai_provider IN ('anthropic', 'google'));
END $$;

DO $$
BEGIN
  ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
  ALTER TABLE applications ADD CONSTRAINT applications_status_check
    CHECK (status IN ('awaiting_model_selection', 'pending', 'scored', 'reviewed', 'scoring_failed'));
END $$;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_suggestions JSONB;

ALTER TABLE applicants ADD COLUMN IF NOT EXISTS personal_statement_path TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS transcript_path TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS cv_path TEXT;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS documents_updated_at TIMESTAMPTZ;
