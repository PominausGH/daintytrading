const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'contact-submissions.jsonl');

function saveSubmission(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const record = { ...data, receivedAt: new Date().toISOString() };
  fs.appendFileSync(SUBMISSIONS_FILE, JSON.stringify(record) + '\n');
}

module.exports = { saveSubmission };
