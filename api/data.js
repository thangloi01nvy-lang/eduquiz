import fs from 'fs';
import path from 'path';

const DB_FILE = '/tmp/database.json';

const DEFAULT_DB = {
  quizTitle: 'Bài Tập Tiếng Anh Online',
  quizLevel: 'B1',
  quizTargetClass: 'all',
  currentQuestions: [],
  sections: [],
  wordBank: [],
  classes: [],
  deletedClasses: [],
  classAssignments: {},
  quizLibrary: [],
  grades: [],
  feedbacks: []
};

function getDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (e) {}
  return DEFAULT_DB;
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

  if (req.method === 'GET') {
    const db = getDb();
    return res.status(200).json({ success: true, data: db });
  }

  if (req.method === 'POST') {
    const payload = req.body;
    const current = getDb();
    const merged = { ...current, ...payload };
    saveDb(merged);
    return res.status(200).json({ success: true, message: 'Server database updated', data: merged });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
