const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function formatUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    created_at: row.created_at,
    university_name: row.university_name || null,
    full_name: row.full_name || null,
    university: row.university_id
      ? {
          id: row.university_id,
          university_name: row.university_name
        }
      : null,
    applicant: row.applicant_id
      ? {
          id: row.applicant_id,
          full_name: row.full_name
        }
      : null
  };
}

async function getUserById(userId) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.role, u.name, u.created_at,
            univ.id AS university_id, univ.university_name,
            app.id AS applicant_id, app.full_name
     FROM users u
     LEFT JOIN universities univ ON univ.user_id = u.id
     LEFT JOIN applicants app ON app.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getUserByEmail(email) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.role, u.name, u.password_hash, u.created_at,
            univ.id AS university_id, univ.university_name,
            app.id AS applicant_id, app.full_name
     FROM users u
     LEFT JOIN universities univ ON univ.user_id = u.id
     LEFT JOIN applicants app ON app.user_id = u.id
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

router.post('/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const email = req.body.email;
    const password = req.body.password;
    const role = req.body.role;
    const providedName = req.body.name;
    const universityName = req.body.university_name;
    const fullName = req.body.full_name;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'email, password, and role are required' });
    }
    if (!['applicant', 'university'].includes(role)) {
      return res.status(400).json({ error: 'role must be applicant or university' });
    }

    const name = providedName || (role === 'university' ? universityName : fullName) || email.split('@')[0];

    if (role === 'university' && !universityName && !providedName) {
      return res.status(400).json({ error: 'university_name is required for role university' });
    }

    const hash = await bcrypt.hash(password, 12);

    await client.query('BEGIN');

    const userInsert = await client.query(
      `INSERT INTO users (email, password_hash, role, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, name, created_at`,
      [email.toLowerCase(), hash, role, name]
    );

    const user = userInsert.rows[0];

    if (role === 'university') {
      await client.query(
        `INSERT INTO universities (user_id, university_name)
         VALUES ($1, $2)`,
        [user.id, universityName || name]
      );
    } else {
      await client.query(
        `INSERT INTO applicants (user_id, full_name)
         VALUES ($1, $2)`,
        [user.id, fullName || name]
      );
    }

    await client.query('COMMIT');

    const hydrated = await getUserById(user.id);
    const token = signToken(hydrated);
    return res.status(201).json({ token, user: formatUser(hydrated) });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    delete user.password_hash;
    return res.json({ token, user: formatUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: formatUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
