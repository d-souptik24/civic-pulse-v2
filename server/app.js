import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { supabase } from './lib/supabase.js';

dotenv.config();

export const app = express();

// Required for Vercel: trust the upstream proxy so rate limiters see the real client IP.
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────
// Limit JSON body to 1mb — photos must be uploaded to Supabase Storage first;
// only the resulting URL is sent here. Vercel enforces a 4.5mb hard cap anyway.
app.use(express.json({ limit: '1mb' }));

// CORS is only needed in local dev. In production, Vercel serves both the React
// frontend and this API from the same origin so browsers never issue a CORS preflight.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}

// ── Rate Limiters ─────────────────────────────────────────────────────────────
// Global limiter: prevents API DDoS and runaway Gemini token costs.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter on the AI analysis endpoint — each call costs Gemini tokens.
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many analysis requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/analyze', analyzeLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
import analyzeRouter from './routes/analyze.js';
import issuesRouter from './routes/issues.js';
import insightsRouter from './routes/insights.js';
import escalateRouter from './routes/escalate.js';
import verifyResolutionRouter from './routes/verify-resolution.js';

app.use('/api/analyze', analyzeRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/escalate', escalateRouter);
app.use('/api/verify-resolution', verifyResolutionRouter);

// ── Health Check (Database Keep-Alive) ─────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('issues').select('id').limit(1);
    if (error) throw error;
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── API 404 handler ───────────────────────────────────────────────────────────
// Must come before any catch-all. Avoids path-to-regexp wildcard issues in Express 5.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
  }
  next();
});

// ── Standalone Docker Production Static Serving ──────────────────────────────
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  // SPA fallback for client-side routing
  app.get(/(.*)/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}
