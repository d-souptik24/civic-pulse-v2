import express from 'express';
import { supabase } from '../lib/supabase.js';
import { callGemini, extractJSON, toInlineImage } from '../lib/gemini.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Pipeline 5: AI Resolution Verifier
// POST /api/verify-resolution
// Receives: { issueId, resolvedPhotoUrl }
// Returns:  { resolved: boolean, confidence: number, explanation: string }
router.post('/', auth, async (req, res) => {
  const { issueId, resolvedPhotoUrl } = req.body;

  if (!issueId || !resolvedPhotoUrl) {
    return res.status(400).json({ error: 'Missing issueId or resolvedPhotoUrl' });
  }

  try {
    // 1. Fetch the issue to get the original "before" photo
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('photo_url, reported_by')
      .eq('id', issueId)
      .single();

    if (fetchError || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (!issue.photo_url) {
      return res.status(400).json({ error: 'Issue has no original photo to compare against' });
    }

    // 2. Download both images for Gemini inline data
    const [beforeRes, afterRes] = await Promise.all([
      fetch(issue.photo_url),
      fetch(resolvedPhotoUrl),
    ]);

    if (!beforeRes.ok || !afterRes.ok) {
      return res.status(502).json({ error: 'Failed to download one or both images' });
    }

    const [beforeBuffer, afterBuffer] = await Promise.all([
      beforeRes.arrayBuffer(),
      afterRes.arrayBuffer(),
    ]);

    const beforeBase64 = Buffer.from(beforeBuffer).toString('base64');
    const afterBase64  = Buffer.from(afterBuffer).toString('base64');

    const beforeMime = beforeRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const afterMime  = afterRes.headers.get('content-type')?.split(';')[0]  || 'image/jpeg';

    // 3. Send both images to Gemini for visual comparison
    const prompt = `
You are an AI resolution verifier for a civic issue reporting platform.
You will receive TWO images:
- Image 1 (BEFORE): The original civic problem reported by a citizen.
- Image 2 (AFTER): A photo submitted by a field officer claiming the issue is fixed.

Your task: Carefully compare the two images and determine if the civic issue has been genuinely resolved.

Respond with ONLY a valid JSON object. No explanations, no markdown:
{
  "resolved": true or false,
  "confidence": a decimal between 0 and 1,
  "explanation": "A single, concise sentence explaining your verdict"
}
    `.trim();

    const rawText = await callGemini(
      prompt,
      [toInlineImage(beforeBase64, beforeMime), toInlineImage(afterBase64, afterMime)],
      20000,
      'minimal'
    );

    const verdict = extractJSON(rawText);

    if (!verdict || typeof verdict.resolved !== 'boolean') {
      return res.status(500).json({ error: 'AI returned an unparsable verdict' });
    }

    // 4. Write results to Supabase (sequential — no transaction needed for this pattern)
    if (verdict.resolved) {
      const now = new Date().toISOString();

      const updatedHistory = [
        ...(issue.status_history || []),
        { status: 'resolved', timestamp: now, changed_by: 'ai_verifier' }
      ];

      // Update the issue to resolved
      await supabase
        .from('issues')
        .update({
          status:                    'resolved',
          resolved_photo_url:        resolvedPhotoUrl,
          resolved_at:               now,
          ai_resolution_verified:    true,
          ai_resolution_explanation: verdict.explanation,
          status_history:            updatedHistory,
        })
        .eq('id', issueId);

      // Award the original reporter +100 pts and Community Savior badge
      if (issue.reported_by) {
        await supabase.rpc('increment_user_points', {
          uid: issue.reported_by,
          delta: 100,
        });
        const { data: prof } = await supabase
          .from('profiles')
          .select('issues_resolved')
          .eq('id', issue.reported_by)
          .maybeSingle();
        await supabase
          .from('profiles')
          .update({ issues_resolved: (prof?.issues_resolved || 0) + 1 })
          .eq('id', issue.reported_by);
        await supabase.rpc('add_user_badge', {
          uid: issue.reported_by,
          badge: 'Community Savior',
        });
      }
    }
    // If verdict is false, we write nothing — the rejection is returned to the frontend only.

    // 5. Return verdict to frontend
    res.json({
      resolved:    verdict.resolved,
      confidence:  verdict.confidence ?? null,
      explanation: verdict.explanation,
    });

  } catch (error) {
    console.error('Resolution verification failed:', error);
    res.status(500).json({ error: 'Failed to verify resolution' });
  }
});

export default router;
