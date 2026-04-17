require('dotenv').config();
const express = require('express');
const { ensureSchema } = require('./db');
const authRoutes = require('./routes/auth');
const universityRoutes = require('./routes/university');
const applicantRoutes = require('./routes/applicant');
const scoreRoutes = require('./routes/score');
const chatRoutes = require('./routes/chat');
const candidatesRoutes = require('./routes/candidates');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const app = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/university', universityRoutes);
app.use('/api/university/candidates', candidatesRoutes);
app.use('/api/applicant', applicantRoutes);
app.use('/api/score', scoreRoutes);
app.use('/api/chat', chatRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

let server;

async function startServer() {
  await ensureSchema();
  const port = Number(process.env.PORT || 4000);
  server = app.listen(port, () => {
    console.log('Backend API listening on port ' + port);
  });
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer
};
