const bcrypt = require('bcryptjs');
const { query, ensureSchema, pool } = require('../src/db');

const DEMO_UNIVERSITY = {
  email: 'admissions@northbridge.ac.uk',
  password: 'UniDemo123!',
  role: 'university',
  name: 'Northbridge Admissions',
  university_name: 'Northbridge University'
};

const DEMO_APPLICANT = {
  email: 'alex.morgan@example.com',
  password: 'ApplicantDemo123!',
  role: 'applicant',
  name: 'Alex Morgan',
  full_name: 'Alex Morgan'
};

const DEGREE_ROWS = [
  {
    course_name: 'MSc Data Science',
    department: 'Computer Science',
    duration_years: 1,
    public_description:
      'A one-year intensive postgraduate programme covering machine learning, statistics, and production-grade analytics systems.',
    public_requirements:
      'Minimum 2:1 in a quantitative discipline. Prior programming experience in Python or R preferred.',
    hidden_criteria:
      'Strong evidence of independent research, practical ML deployment exposure, and clear communication of statistical trade-offs.'
  },
  {
    course_name: 'MSc Cyber Security',
    department: 'Computer Science',
    duration_years: 1,
    public_description:
      'A specialised programme focused on secure systems engineering, digital forensics, and modern incident response.',
    public_requirements:
      'Bachelor degree in computing, engineering, or equivalent experience. Familiarity with Linux and networking fundamentals expected.',
    hidden_criteria:
      'Depth in threat modelling, secure coding mindset, and demonstrated curiosity through capture-the-flag or lab projects.'
  }
];

async function upsertUser(account) {
  const hash = await bcrypt.hash(account.password, 12);
  const result = await query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       name = EXCLUDED.name
     RETURNING id, email, role, name`,
    [account.email.toLowerCase(), hash, account.role, account.name]
  );
  return result.rows[0];
}

async function upsertUniversityProfile(user) {
  const result = await query(
    `INSERT INTO universities (user_id, university_name)
     VALUES ($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET university_name = EXCLUDED.university_name
     RETURNING id, university_name`,
    [user.id, DEMO_UNIVERSITY.university_name]
  );
  return result.rows[0];
}

async function upsertApplicantProfile(user) {
  const result = await query(
    `INSERT INTO applicants (user_id, full_name)
     VALUES ($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id, full_name`,
    [user.id, DEMO_APPLICANT.full_name]
  );
  return result.rows[0];
}

async function seed() {
  await ensureSchema();

  const universityUser = await upsertUser(DEMO_UNIVERSITY);
  const applicantUser = await upsertUser(DEMO_APPLICANT);
  const university = await upsertUniversityProfile(universityUser);
  const applicant = await upsertApplicantProfile(applicantUser);

  await query(
    `DELETE FROM applications
     WHERE applicant_id = $1
       AND degree_id IN (
         SELECT id FROM degree_listings
         WHERE university_id = $2
           AND course_name = ANY($3::text[])
       )`,
    [applicant.id, university.id, DEGREE_ROWS.map((row) => row.course_name)]
  );

  await query('DELETE FROM degree_listings WHERE university_id = $1 AND course_name = ANY($2::text[])', [
    university.id,
    DEGREE_ROWS.map((row) => row.course_name)
  ]);

  const insertedDegrees = [];
  for (const degree of DEGREE_ROWS) {
    const result = await query(
      `INSERT INTO degree_listings (
         university_id, course_name, department, duration_years,
         public_description, public_requirements, hidden_criteria
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, course_name`,
      [
        university.id,
        degree.course_name,
        degree.department,
        degree.duration_years,
        degree.public_description,
        degree.public_requirements,
        degree.hidden_criteria
      ]
    );
    insertedDegrees.push(result.rows[0]);
  }

  const applicationResult = await query(
    `INSERT INTO applications (
       degree_id, applicant_id, personal_statement_path, transcript_path, cv_path,
       ai_score, ai_reasoning, status, scored_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'scored', NOW())
     RETURNING id`,
    [
      insertedDegrees[0].id,
      applicant.id,
      '/uploads/demo/pre_scored/personal_statement.pdf',
      '/uploads/demo/pre_scored/transcript.pdf',
      '/uploads/demo/pre_scored/cv.pdf',
      8.85,
      'Reasoning: Strong quantitative background, clear motivation, and relevant project delivery experience aligned with programme goals.\nStrengths: Demonstrated ML project execution; Strong motivation statement\nWeaknesses: Limited formal research outputs; Sparse evidence of production system scale\nCriteria Match: Research evidence (medium) - Some independent project work but limited publications | ML deployment (high) - CV shows production-focused internship | Statistical communication (high) - Personal statement clearly explains trade-offs'
    ]
  );

  console.log('Seed complete.');
  console.log(`University: ${DEMO_UNIVERSITY.email} / ${DEMO_UNIVERSITY.password}`);
  console.log(`Applicant: ${DEMO_APPLICANT.email} / ${DEMO_APPLICANT.password}`);
  console.log(`Degrees created: ${insertedDegrees.map((d) => d.course_name).join(', ')}`);
  console.log(`Pre-scored application id: ${applicationResult.rows[0].id}`);
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
