import express from 'express';
import { supabase } from '../lib/supabase.js';
import auth, { requireAdmin } from '../middleware/auth.js';
import { verifyVerdict } from '../lib/token.js';
import { isValidStorageUrl, isValidCoordinate } from '../lib/validation.js';

const router = express.Router();

// ── GET /api/issues ───────────────────────────────────────────────────────────
// List issues with optional category/status filters (Limit 100)
router.get('/', async (req, res) => {
  try {
    const { category, status } = req.query;

    let query = supabase
      .from('issues')
      .select('*')
      .order('reported_at', { ascending: false })
      .limit(100);

    if (category) query = query.eq('category', category);
    if (status)   query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Failed to fetch issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// ── POST /api/issues/deduplicate ─────────────────────────────────────────────
// Geo-Deduplication Agent (Pipeline 2):
// Checks 200m radius for an open issue of the same category using PostGIS.
// Replaces ~30 lines of geofire bounding-box math with a single RPC call.
router.post('/deduplicate', auth, async (req, res) => {
  try {
    const { lat, lng, category } = req.body;
    if (!category || !isValidCoordinate(lat, lng)) {
      return res.status(400).json({ error: 'Missing category or invalid coordinates' });
    }

    const { data, error } = await supabase.rpc('find_nearby_issues', {
      lat,
      lng,
      radius_meters: 200,
      filter_category: category,
      filter_status: 'open',
    });

    if (error) throw error;

    if (data && data.length > 0) {
      res.json({ isDuplicate: true, duplicateId: data[0].id });
    } else {
      res.json({ isDuplicate: false });
    }
  } catch (error) {
    console.error('Deduplication check failed:', error);
    res.status(500).json({ error: 'Deduplication check failed' });
  }
});

// ── POST /api/issues ──────────────────────────────────────────────────────────
// Issue Creation with Gamification
router.post('/', auth, async (req, res) => {
  try {
    const {
      imageUrl, category, severity, title, description,
      location, isAuthentic, confidence, reasoning,
      verdictToken
    } = req.body;

    const userId = req.user.uid;

    if (!isValidCoordinate(location?.lat, location?.lng)) {
      return res.status(400).json({ error: 'Missing or invalid location coordinates' });
    }

    if (imageUrl && !isValidStorageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Invalid or unauthorized image URL' });
    }

    // Verify the HMAC-signed AI verdict token — prevents client forgery
    const verdict = verifyVerdict(verdictToken);
    if (!verdict.valid) {
      console.warn(`Verdict token rejected for user ${userId}: ${verdict.reason}`);
      return res.status(403).json({
        rejected: true,
        reason: verdict.reason || 'Invalid or missing AI verification token.'
      });
    }

    if (!verdict.data.isAuthentic) {
      console.warn(`Inauthentic submission blocked for user ${userId}`);
      return res.status(403).json({
        rejected: true,
        reason: 'Our AI could not identify a civic infrastructure issue in this photo.'
      });
    }

    // Token-Binding Check: Ensure the submitted image URL matches the one that was analyzed
    if (verdict.data.imageUrl && imageUrl && verdict.data.imageUrl !== imageUrl) {
      console.warn(`Image URL mismatch for user ${userId}`);
      return res.status(403).json({
        rejected: true,
        reason: 'Image URL mismatch between AI verification and issue submission.'
      });
    }

    // Build issue record — location stored as PostGIS geography point
    const newIssue = {
      title:        title || 'Reported Issue',
      description:  description || '',
      category,
      severity,
      status:       'open',
      status_history: [{ status: 'open', timestamp: new Date().toISOString(), changed_by: 'system' }],
      location:     `POINT(${location.lng} ${location.lat})`, // PostGIS WKT format
      photo_url:    imageUrl || null,
      upvotes:      0,
      upvoted_by:   [],
      reported_by:  userId,
      reported_at:  new Date().toISOString(),
      ai_category:          category,
      ai_severity:          severity,
      ai_authenticity:      !!isAuthentic,
      ai_reasoning:         reasoning || null,
      confidence:           confidence || 0,
      ai_escalation_summary:  null,
      ai_resolution_verified: null,
      ai_resolution_explanation: null,
    };

    const { data: issue, error: insertError } = await supabase
      .from('issues')
      .insert(newIssue)
      .select()
      .single();

    if (insertError) throw insertError;

    // Gamification: +75 pts for an AI-authenticated report, 0 for unverified
    const pointsAwarded = isAuthentic ? 75 : 0;

    const { data: prof } = await supabase
      .from('profiles')
      .select('reports_count, points')
      .eq('id', userId)
      .maybeSingle();

    const profileUpdates = { reports_count: (prof?.reports_count || 0) + 1 };
    if (pointsAwarded > 0) {
      profileUpdates.points = (prof?.points || 0) + pointsAwarded;
    }
    await supabase.from('profiles').update(profileUpdates).eq('id', userId);

    // Category badge (only if not already awarded — handled by add_user_badge RPC)
    const CATEGORY_BADGES = {
      pothole:     'Pothole Patrol',
      water_leak:  'Water Warden',
      streetlight: 'Light Keeper',
    };
    const badge = CATEGORY_BADGES[category];
    if (badge) {
      await supabase.rpc('add_user_badge', { uid: userId, badge });
    }

    res.status(201).json({ id: issue.id, ...issue, pointsAwarded });
  } catch (error) {
    console.error('Failed to create issue:', error);
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

// Toggle upvote — handled entirely inside a single atomic PostgreSQL function (toggle_upvote).
router.post('/:id/upvote', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    // Verify issue exists first
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // toggle_upvote RPC handles all atomic reads/writes in the database
    const { data: didUpvote, error } = await supabase.rpc('toggle_upvote', {
      issue_id: id,
      voter_id: userId,
    });

    if (error) throw error;

    res.json({
      success: true,
      message: didUpvote ? 'Upvote added' : 'Upvote removed',
    });
  } catch (error) {
    console.error('Upvote failed:', error);
    res.status(500).json({ error: 'Failed to process upvote' });
  }
});

// ── PATCH /api/issues/:id/status ──────────────────────────────────────────────
// Admin action: change issue status (e.g., mark as in_progress)
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const ALLOWED_STATUSES = ['in_progress'];
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` });
    }

    const { data: issue, error: fetchErr } = await supabase
      .from('issues')
      .select('status_history')
      .eq('id', id)
      .single();

    if (fetchErr || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const updatedHistory = [
      ...(issue.status_history || []),
      { status, timestamp: new Date().toISOString(), changed_by: req.user.uid }
    ];

    const { error } = await supabase
      .from('issues')
      .update({
        status,
        status_history: updatedHistory,
      })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: `Issue status updated to ${status}` });
  } catch (error) {
    console.error('Status update failed:', error);
    res.status(500).json({ error: 'Failed to update issue status' });
  }
});

export default router;
