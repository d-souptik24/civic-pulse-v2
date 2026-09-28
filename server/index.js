/**
 * server/index.js — Local development runner only.
 *
 * In production (Vercel), api/index.js is the entry point.
 * This file exists purely so `npm run dev` works locally.
 */
import { app } from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Dev server running on http://localhost:${PORT}`);
});
