/**
 * api/index.js — Vercel Serverless Function entry point.
 *
 * Vercel routes all /api/* requests here. We import the Express app and
 * export it as the default handler — Vercel wraps it automatically.
 *
 * NOTE: Do NOT call app.listen() here. Vercel manages the server lifecycle.
 */
import { app } from '../server/app.js';

export default app;
