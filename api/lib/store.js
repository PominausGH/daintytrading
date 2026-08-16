const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'contact-submissions.jsonl');
const REVIEWS_FILE = path.join(DATA_DIR, 'review-submissions.jsonl');

function saveSubmission(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const record = { ...data, receivedAt: new Date().toISOString() };
  fs.appendFileSync(SUBMISSIONS_FILE, JSON.stringify(record) + '\n', { mode: 0o600 });
  fs.chmodSync(SUBMISSIONS_FILE, 0o600);
}

function saveReview(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const record = { ...data, receivedAt: new Date().toISOString(), status: 'pending' };
  fs.appendFileSync(REVIEWS_FILE, JSON.stringify(record) + '\n', { mode: 0o600 });
  fs.chmodSync(REVIEWS_FILE, 0o600);
}

module.exports = { saveSubmission, saveReview };
