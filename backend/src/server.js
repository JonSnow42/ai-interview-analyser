import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { buildCandidateProfile } from './profileBuilder.js';
import { evaluateCandidateAgents } from './agents.js';
import { runCandidateDebate } from './debate.js';
import { runFinalDecision } from './decision.js';
import { isApiKeyConfigured } from './llmClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Set up upload directories
const uploadDir = path.join(__dirname, '../uploads');
const cacheDir = path.join(__dirname, '../cache');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    let targetName = '';
    if (file.fieldname === 'jobDescription') targetName = 'job_description.pdf';
    else if (file.fieldname === 'resumeA') targetName = 'resume_a.pdf';
    else if (file.fieldname === 'resumeB') targetName = 'resume_b.pdf';
    else if (file.fieldname === 'transcriptA') targetName = 'transcript_a.pdf';
    else if (file.fieldname === 'transcriptB') targetName = 'transcript_b.pdf';
    cb(null, targetName);
  }
});

const upload = multer({ storage });
const uploadFields = upload.fields([
  { name: 'jobDescription', maxCount: 1 },
  { name: 'resumeA', maxCount: 1 },
  { name: 'resumeB', maxCount: 1 },
  { name: 'transcriptA', maxCount: 1 },
  { name: 'transcriptB', maxCount: 1 }
]);

// Clear JSON and TXT caches helper
function clearCache() {
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir);
    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.txt')) {
        fs.unlinkSync(path.join(cacheDir, file));
      }
    }
  }
}

// Helper to delete an uploaded file
const deleteUploadedFile = (filename) => {
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`[Server] Deleted stale file: ${filename}`);
  }
};

// API Key Status route (returns only whether key is set in backend .env)
app.get('/api/config', (req, res) => {
  res.json({ configured: isApiKeyConfigured() });
});

// Single Endpoint to Upload PDFs and run the Full Pipeline
app.post('/api/upload-pipeline', uploadFields, async (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');

  const sendStatus = (status, data = null) => {
    res.write(JSON.stringify({ status, data }) + '\n');
  };

  try {
    const live = isApiKeyConfigured();
    if (!live) {
      throw new Error('Gemini API key is not configured in backend/.env. Live Gemini API execution is required (Mock Mode fallback disabled).');
    }

    sendStatus('Clearing previous evaluation cache...');
    clearCache();

    // Remove stale transcript files if not uploaded in the current request
    if (!req.files || !req.files['transcriptA']) {
      deleteUploadedFile('transcript_a.pdf');
    }
    if (!req.files || !req.files['transcriptB']) {
      deleteUploadedFile('transcript_b.pdf');
    }

    console.log(`[Pipeline] Starting execution. Live Mode = ${live}`);

    // Candidate A Profile
    sendStatus('Building Profile for Candidate A (Rohan)...');
    const profileA = await buildCandidateProfile('A');

    // Candidate B Profile
    sendStatus('Building Profile for Candidate B (Ananya)...');
    const profileB = await buildCandidateProfile('B');

    // Candidate A Independent Agents
    sendStatus('Running 4 Independent Appraisals for Rohan...');
    const opinionsA = await evaluateCandidateAgents('A', profileA);

    // Candidate B Independent Agents
    sendStatus('Running 4 Independent Appraisals for Ananya...');
    const opinionsB = await evaluateCandidateAgents('B', profileB);

    // Candidate A Debate
    sendStatus('Orchestrating Panel Debate for Rohan...');
    const debateA = await runCandidateDebate('A', profileA, opinionsA);

    // Candidate B Debate
    sendStatus('Orchestrating Panel Debate for Ananya...');
    const debateB = await runCandidateDebate('B', profileB, opinionsB);

    // Candidate A Decision
    sendStatus('Finalizing Decision Verdict for Rohan...');
    const decisionA = await runFinalDecision('A', profileA, opinionsA, debateA);

    // Candidate B Decision
    sendStatus('Finalizing Decision Verdict for Ananya...');
    const decisionB = await runFinalDecision('B', profileB, opinionsB, debateB);

    sendStatus('Complete', {
      A: { profile: profileA, opinions: opinionsA, debate: debateA, decision: decisionA },
      B: { profile: profileB, opinions: opinionsB, debate: debateB, decision: decisionB }
    });
    res.end();
  } catch (error) {
    console.error('[Pipeline Error]', error);
    sendStatus('Error: ' + error.message);
    res.end();
  }
});

// Fetch full candidate evaluation details
app.post('/api/candidate/full-pipeline', async (req, res) => {
  const { candidateId } = req.body;
  if (!candidateId || !['A', 'B'].includes(candidateId.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid candidateId. Must be "A" or "B".' });
  }
  
  const cid = candidateId.toUpperCase();
  const live = isApiKeyConfigured();

  if (!live) {
    return res.status(500).json({ error: 'Gemini API key is not configured in backend/.env. Live Gemini API execution is required.' });
  }

  try {
    const profile = await buildCandidateProfile(cid);
    const opinions = await evaluateCandidateAgents(cid, profile);
    const debateLog = await runCandidateDebate(cid, profile, opinions);
    const decisionResult = await runFinalDecision(cid, profile, opinions, debateLog);
    
    res.json({
      success: true,
      profile,
      opinions,
      debate: debateLog,
      decision: decisionResult,
      isMock: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Cache Endpoint
app.post('/api/candidate/reset-cache', (req, res) => {
  try {
    clearCache();
    res.json({ success: true, message: 'JSON and text caches cleared successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache: ' + error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});
