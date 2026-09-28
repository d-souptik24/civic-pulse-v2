import express from 'express';
import { supabase } from '../lib/supabase.js';
import { callGemini } from '../lib/gemini.js';
import auth from '../middleware/auth.js';

const router = express.Router();



// Pipeline 3: Predictive Hotspot Mapper
// POST /api/insights
router.post('/', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng' });
    }

    const cacheKey = `${Math.round(lat * 100) / 100}_${Math.round(lng * 100) / 100}`;
    const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

    // 1. Check cache
    const { data: cached } = await supabase
      .from('insights')
      .select('insight, issue_count, last_updated')
      .eq('geohash', cacheKey)
      .single();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.last_updated).getTime();
      if (ageMs < CACHE_TTL_MS) {
        return res.json({
          geohash: cacheKey,
          insight: cached.insight,
          issueCount: cached.issue_count,
          cached: true,
        });
      }
    }

    // 2. Cache miss — query issues within ~5km using PostGIS
    const { data: issues, error } = await supabase.rpc('find_nearby_issues', {
      lat,
      lng,
      radius_meters: 5000, // 5km radius for insights (broader than dedup)
      filter_category: null,
      filter_status: null,
    });

    if (error) throw error;

    if (!issues || issues.length === 0) {
      return res.json({
        geohash: cacheKey,
        insight: 'No recent civic issues reported in this area.',
        issueCount: 0,
        cached: false,
      });
    }

    // 3. Aggregate stats
    const stats = issues.reduce(
      (acc, issue) => {
        acc.total++;
        const cat = issue.category || 'other';
        acc.categories[cat] = (acc.categories[cat] || 0) + 1;
        if (issue.status === 'resolved') acc.resolved++;
        else acc.open++;
        return acc;
      },
      { total: 0, categories: {}, open: 0, resolved: 0 }
    );

    // 4. Generate insight via Gemini
    const prompt = `
You are an expert civic AI analyzing a 5km city area.
Here is the aggregated data for issues reported in this grid:
Total Issues: ${stats.total}
Open: ${stats.open}
Resolved: ${stats.resolved}
Categories: ${JSON.stringify(stats.categories)}

Provide a concise, 1-to-2 sentence analytical insight. Highlight the biggest problem or a positive trend. Be professional and data-driven. Do NOT use markdown.
    `.trim();

    const insightText = await callGemini(prompt, [], 15000, 'minimal');

    // 5. Upsert cache
    await supabase.from('insights').upsert({
      geohash: cacheKey,
      insight: insightText.trim(),
      issue_count: stats.total,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'geohash' });

    res.json({
      geohash: cacheKey,
      insight: insightText.trim(),
      issueCount: stats.total,
      cached: false,
    });

  } catch (error) {
    console.error('Insights generation failed:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

export default router;
