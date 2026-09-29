import express from 'express';
import { supabase } from '../lib/supabase.js';
import { callGemini } from '../lib/gemini.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Pipeline 4: Autonomous Escalation Agent
// POST /api/escalate?demo=true
router.post('/', requireAdmin, async (req, res) => {
  try {
    const isDemo = req.query.demo === 'true';

    // 1. Fetch open issues (+ upvote threshold filter pushed to DB)
    let query = supabase
      .from('issues')
      .select('id, title, category, description, upvotes, reported_at, ai_authenticity, status_history')
      .eq('status', 'open')
      .gte('upvotes', 3); // must have at least 3 upvotes

    // 2. Age filter — older than 24h, unless in demo mode
    if (!isDemo) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.lte('reported_at', cutoff);
    }

    const { data: qualifyingIssues, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!qualifyingIssues || qualifyingIssues.length === 0) {
      return res.json({ escalatedCount: 0, message: 'No issues met the escalation criteria.' });
    }

    // 3. Generate escalation summaries via Gemini (sequential with built-in throttling)
    const escalatedResults = [];

    for (const issue of qualifyingIssues) {
      const prompt = `
You are an autonomous civic agent. Draft a formal, professional escalation summary to the municipal authorities regarding the following unresolved public issue:
Title: ${issue.title}
Category: ${issue.category}
Description: ${issue.description || 'No description provided'}
Community Upvotes: ${issue.upvotes}
AI Authenticated: ${issue.ai_authenticity ? 'Yes' : 'No'}

Write exactly one paragraph outlining why this needs immediate attention. Be formal. Do not use markdown.
      `.trim();

      try {
        const summary = await callGemini(prompt, [], 20000, 'minimal');
        escalatedResults.push({ id: issue.id, summary: summary.trim() });
      } catch (err) {
        console.error(`Gemini failed for issue ${issue.id}:`, err);
        // Skip this issue; let the rest process
      }
    }

    if (escalatedResults.length === 0) {
      return res.status(500).json({ error: 'Failed to generate any escalation summaries.' });
    }

    // 4. Batch update — Supabase has no 500-op limit, so one call is all we need
    const now = new Date().toISOString();

    for (const result of escalatedResults) {
      const issueObj = qualifyingIssues.find(i => i.id === result.id);
      const updatedHistory = [
        ...(issueObj?.status_history || []),
        { status: 'escalated', timestamp: now, changed_by: 'system' }
      ];
      await supabase
        .from('issues')
        .update({
          status: 'escalated',
          ai_escalation_summary: result.summary,
          status_history: updatedHistory,
        })
        .eq('id', result.id);
    }

    res.json({
      escalatedCount: escalatedResults.length,
      message: `Successfully escalated ${escalatedResults.length} issues.`,
      issues: escalatedResults,
    });

  } catch (error) {
    console.error('Escalation Agent failed:', error);
    res.status(500).json({ error: 'Failed to run Escalation Agent' });
  }
});

export default router;
