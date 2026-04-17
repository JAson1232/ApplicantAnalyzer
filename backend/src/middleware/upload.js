const fs = require('fs');
const path = require('path');
const multer = require('multer');

const MAX_PDF_SIZE = 25 * 1024 * 1024;
const uploadRoot = process.env.UPLOAD_DIR || '/app/uploads';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.user || req.user.role !== 'applicant') {
      return cb(new Error('Only applicants can upload files'));
    }
    if (!req.applicationId || !req.applicantProfileId) {
      return cb(new Error('Application context missing for upload'));
    }
    const uploadPath = path.join(uploadRoot, String(req.applicantProfileId), String(req.applicationId));
    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const safeName = file.fieldname.replace(/[^a-z_]/gi, '').toLowerCase();
    cb(null, safeName + '.pdf');
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const validMime = file.mimetype === 'application/pdf';
  const validExt = ext === '.pdf';

  if (!validMime || !validExt) {
    return cb(new Error('Only PDF files are allowed'));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_PDF_SIZE
  }
}).fields([
  { name: 'personal_statement', maxCount: 1 },
  { name: 'transcript', maxCount: 1 },
  { name: 'cv', maxCount: 1 }
]);

function uploadMiddleware(req, res, next) {
  const startedAt = Date.now();
  const reqTag = `[upload][user:${req.user?.id || 'unknown'}][app:${req.applicationId || 'unknown'}]`;
  const contentLength = req.headers['content-length'] || 'unknown';
  console.info(`${reqTag} started content-length=${contentLength}`);

  req.on('aborted', () => {
    console.warn(`${reqTag} request aborted by client after ${Date.now() - startedAt}ms`);
  });

  upload(req, res, (err) => {
    if (err) {
      console.error(
        `${reqTag} failed after ${Date.now() - startedAt}ms code=${err.code || 'none'} message="${err.message}"`
      );
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Each file must be <= 25MB' });
      }
      return res.status(400).json({ error: err.message });
    }

    const uploadedFiles = Object.entries(req.files || {}).flatMap(([field, items]) =>
      (items || []).map((item) => `${field}:${item.size || 0}B`)
    );
    console.info(
      `${reqTag} completed in ${Date.now() - startedAt}ms files=${uploadedFiles.length} ${uploadedFiles.join(', ')}`
    );
    return next();
  });
}

const candidateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.user || req.user.role !== 'university') {
      return cb(new Error('Only university users can upload candidate files'));
    }
    if (!req.universityProfileId || !req.candidateId) {
      return cb(new Error('University/candidate context missing for upload'));
    }
    const uploadPath = path.join(uploadRoot, 'candidates', String(req.universityProfileId), String(req.candidateId));
    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const safeName = file.fieldname.replace(/[^a-z_]/gi, '').toLowerCase();
    cb(null, safeName + '.pdf');
  }
});

const candidateUpload = multer({
  storage: candidateStorage,
  fileFilter,
  limits: { fileSize: MAX_PDF_SIZE }
}).fields([
  { name: 'personal_statement', maxCount: 1 },
  { name: 'transcript', maxCount: 1 },
  { name: 'cv', maxCount: 1 }
]);

function uploadCandidateMiddleware(req, res, next) {
  const reqTag = `[candidate-upload][user:${req.user?.id || 'unknown'}][candidate:${req.candidateId || 'unknown'}]`;
  console.info(`${reqTag} started`);

  candidateUpload(req, res, (err) => {
    if (err) {
      console.error(`${reqTag} failed code=${err.code || 'none'} message="${err.message}"`);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Each file must be <= 25MB' });
      }
      return res.status(400).json({ error: err.message });
    }

    const uploadedFiles = Object.entries(req.files || {}).flatMap(([field, items]) =>
      (items || []).map((item) => `${field}:${item.size || 0}B`)
    );
    console.info(`${reqTag} completed files=${uploadedFiles.length} ${uploadedFiles.join(', ')}`);
    return next();
  });
}

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.user || req.user.role !== 'applicant') {
      return cb(new Error('Only applicants can upload files'));
    }
    if (!req.applicantProfileId) {
      return cb(new Error('Applicant profile context missing for upload'));
    }
    const uploadPath = path.join(uploadRoot, String(req.applicantProfileId), 'profile');
    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const safeName = file.fieldname.replace(/[^a-z_]/gi, '').toLowerCase();
    cb(null, safeName + '.pdf');
  }
});

const profileUpload = multer({
  storage: profileStorage,
  fileFilter,
  limits: { fileSize: MAX_PDF_SIZE }
}).fields([
  { name: 'personal_statement', maxCount: 1 },
  { name: 'transcript', maxCount: 1 },
  { name: 'cv', maxCount: 1 }
]);

function uploadProfileMiddleware(req, res, next) {
  profileUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Each file must be <= 25MB' });
      }
      return res.status(400).json({ error: err.message });
    }
    return next();
  });
}

module.exports = {
  uploadMiddleware,
  uploadCandidateMiddleware,
  uploadProfileMiddleware
};
