import fs from 'fs';
import path from 'path';

const DB_FILE = '/tmp/database.json';

function getDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { grades: [] };
}

function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const submission = req.body;
    if (!submission || !submission.studentId) {
      return res.status(400).json({ success: false, error: 'Invalid submission payload' });
    }

    const currentDb = getDb();
    if (!Array.isArray(currentDb.grades)) currentDb.grades = [];

    const existingIdx = currentDb.grades.findIndex(g => g.id === submission.id);
    if (existingIdx >= 0) {
      currentDb.grades[existingIdx] = submission;
    } else {
      currentDb.grades.unshift(submission);
    }

    saveDb(currentDb);
    return res.status(200).json({ success: true, message: 'Submission saved atomically', submission });
  }

  if (req.method === 'GET') {
    const currentDb = getDb();
    return res.status(200).json({ success: true, submissions: currentDb.grades || [] });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
