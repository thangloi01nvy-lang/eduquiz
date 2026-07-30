import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.json');

// Default Database Structure
const DEFAULT_DB = {
  quizTitle: 'Bài Tập Tiếng Anh Online',
  quizLevel: 'B1',
  quizTargetClass: 'all',
  currentQuestions: [],
  sections: [],
  wordBank: [],
  classes: [
    {
      id: 'c_teen4',
      name: 'Teen 4',
      desc: 'Lớp học mới',
      students: [{ id: 's1', name: 'Nguyễn Văn A' }]
    }
  ],
  classAssignments: {},
  quizLibrary: [],
  grades: [],
  feedbacks: []
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('DB load warning, resetting to default:', e);
  }
  saveDatabase(DEFAULT_DB);
  return DEFAULT_DB;
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('DB save error:', e);
  }
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gemini-key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', serverTime: new Date().toISOString() }));
  }

  if (pathname === '/api/data' && req.method === 'GET') {
    const db = loadDatabase();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: db }));
  }

  if (pathname === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const currentDb = loadDatabase();
        const mergedDb = { ...currentDb, ...payload };
        saveDatabase(mergedDb);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'Server database updated', data: mergedDb }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  if (pathname === '/api/ai/generate-quiz' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { topic, level, rawText } = JSON.parse(body);
        const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Chưa cài đặt GEMINI_API_KEY trên Server Backend. Vui lòng đặt biến môi trường GEMINI_API_KEY.'
          }));
        }

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Bạn là chuyên gia giáo dục Tiếng Anh. Hãy tạo bộ đề bài tập theo chủ đề: ${topic || 'Tổng hợp'}, trình độ: ${level || 'B1'}, văn bản: ${rawText || ''}. Định dạng Markdown với ## Bài 1, ## Bài 2, A. B. C. D. và Answer: X` }] }]
          })
        });

        const geminiData = await geminiRes.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, markdown: text }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 EDUQUIZ PRO NATIVE BACKEND SERVER RUNNING ON PORT ${PORT}`);
  console.log(`👉 API Endpoint: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
