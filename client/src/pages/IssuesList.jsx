import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { AlertCircle, CheckCircle, Clock, Filter, ThumbsUp } from 'lucide-react';
import { STATUS_CONFIG } from '../lib/constants.js';
import { timeAgo } from '../lib/utils.js';

// ── Status + Category Configuration ───────────────────────────────────────────

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Pending',      value: 'pending' },
  { label: 'Unverified',   value: 'unverified' },
  { label: 'Open',         value: 'open' },
  { label: 'In Progress',  value: 'in_progress' },
  { label: 'Escalated',    value: 'escalated' },
  { label: 'Resolved',     value: 'resolved' },
];

const CATEGORY_OPTIONS = [
  { label: 'All Categories', value: 'all' },
  { label: 'Pothole',        value: 'pothole' },
  { label: 'Water Leak',     value: 'water_leak' },
  { label: 'Streetlight',    value: 'streetlight' },
  { label: 'Waste',          value: 'waste' },
  { label: 'Road Damage',    value: 'road_damage' },
  { label: 'Sewage',         value: 'sewage' },
  { label: 'Other',          value: 'other' },
];

const CATEGORY_EMOJI = {
  pothole:      '🕳️',
  streetlight:  '💡',
  water_leak:   '💧',
  waste:        '🗑️',
  road_damage:  '🚧',
  sewage:       '🚨',
  encroachment: '🏗️',
  other:        '📍',
};

// Status styles for light-mode cards
// STATUS_LIGHT removed — now imported as STATUS_CONFIG from lib/constants.js



// ── Issue Card ─────────────────────────────────────────────────────────────────
function IssueCard({ issue, onClick }) {
  const cfg = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG.open;
  const emoji = CATEGORY_EMOJI[issue.category] ?? '📍';
  const photo = issue.photo_url || issue.photoUrl;
  const reportedAt = issue.reported_at || issue.reportedAt;
  const aiAuthentic = issue.ai_authenticity ?? issue.aiAuthenticity;

  return (
    <button
      id={`issue-card-${issue.id}`}
      onClick={onClick}
      className="card-white p-4 text-left w-full group transition-all duration-200 hover:scale-[1.01] hover:border-plum-light hover:bg-[#F8F6F4] hover:shadow-md animate-fade-in"
      style={{ display: 'block' }}
    >
      {/* Photo + Status Row */}
      <div className="flex items-start gap-3 mb-3">
        {photo ? (
          <img
            src={photo}
            alt={issue.title}
            className="w-16 h-16 object-cover shrink-0"
            style={{ borderRadius: 'var(--radius-image)', border: '1px solid var(--color-stone-line)' }}
          />
        ) : (
          <div
            className="w-16 h-16 flex items-center justify-center text-2xl shrink-0"
            style={{ borderRadius: 'var(--radius-image)', backgroundColor: 'var(--color-stone-paper)', border: '1px solid var(--color-stone-line)' }}
          >
            {emoji}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p
              className="text-sm font-semibold leading-tight line-clamp-2 transition-colors"
              style={{ color: 'var(--color-ink)' }}
            >
              {issue.title}
            </p>
            <span
              className={`text-[10px] px-2 py-0.5 shrink-0 font-semibold uppercase tracking-wider rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}
            >
              {cfg.label}
            </span>
          </div>
          {issue.description && (
            <p className="text-xs line-clamp-1" style={{ color: 'var(--color-fog)' }}>{issue.description}</p>
          )}
        </div>
      </div>

      {/* Meta Row */}
      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-fog)' }}>
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {timeAgo(reportedAt)}
        </span>
        <span className="flex items-center gap-1">
          <ThumbsUp size={10} />
          {issue.upvotes ?? 0}
        </span>
        {aiAuthentic && (
          <span className="flex items-center gap-1" style={{ color: 'var(--color-signal-green)' }}>
            <CheckCircle size={10} />
            AI Verified
          </span>
        )}
        {issue.severity && (
          <span className="capitalize" style={{ color: 'var(--color-fog)' }}>
            {emoji} {issue.category?.replace('_', ' ')}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function IssuesList() {
  const [issues, setIssues]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter, setCatFilter]       = useState('all');
  const [searchParams] = useSearchParams();
  const reporterFilter = searchParams.get('reporter');
  const targetName = searchParams.get('name');
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);

    if (reporterFilter && reporterFilter !== 'me' && reporterFilter !== user?.uid && !isAdmin) {
      navigate('/issues');
      return;
    }

    async function fetchIssues() {
      let query = supabase
        .from('issues')
        .select('*')
        .order('reported_at', { ascending: false })
        .limit(100);

      if (reporterFilter && reporterFilter !== 'me' && user) {
        query = query.eq('reported_by', reporterFilter);
      } else if (reporterFilter === 'me' && user) {
        query = query.eq('reported_by', user.id);
      }

      const { data, error } = await query;
      if (error) { console.error('Failed to fetch issues:', error); return; }
      setIssues(data ?? []);
      setLoading(false);
    }
    fetchIssues();
  }, [reporterFilter, user, isAdmin, navigate]);

  const filtered = issues.filter((issue) => {
    const statusOk   = statusFilter === 'all' || issue.status === statusFilter;
    const categoryOk = catFilter === 'all'    || issue.category === catFilter;
    return statusOk && categoryOk;
  });

  const selectStyle = {
    width: '100%',
    backgroundColor: 'var(--color-stone-white)',
    border: '1px solid var(--color-stone-line)',
    color: 'var(--color-ink)',
    fontSize: '14px',
    borderRadius: 'var(--radius-control)',
    padding: '8px 32px 8px 12px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236E6A63' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    backgroundSize: '16px',
  };

  return (
    <div
      className="min-h-screen pt-20 pb-24 md:pb-10 px-4 max-w-6xl mx-auto animate-fade-in"
      style={{ backgroundColor: 'var(--color-stone-paper)' }}
    >
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div>
          <h1
            className="font-bold"
            style={{ fontSize: 'var(--text-heading)', lineHeight: 'var(--leading-heading)', color: 'var(--color-ink)' }}
          >
            {reporterFilter === 'me'
              ? 'My Reported Issues'
              : reporterFilter
                ? `${targetName || 'Citizen'}'s Reported Issues`
                : 'Issues Directory'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-fog)' }}>
            {reporterFilter === 'me'
              ? 'All civic issues you have reported'
              : reporterFilter
                ? 'Admin Audit View — Viewing all issues reported by this citizen'
                : 'Browse and filter up to the 100 most recent civic reports'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card-white p-4 sm:p-5 mb-6 flex flex-col md:flex-row gap-4 items-end">
        {/* Header / Icon */}
        <div className="flex items-center gap-2 pb-2.5 self-start md:self-end" style={{ color: 'var(--color-fog)' }}>
          <Filter size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
        </div>

        {/* Status Filter */}
        <div className="flex-1 w-full min-w-40">
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-fog)' }}>
            Status
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex-1 w-full min-w-40">
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-fog)' }}>
            Category
          </label>
          <select
            id="filter-category"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            style={selectStyle}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Result Count Badge */}
        <div className="ml-auto w-full md:w-auto self-start md:self-end flex pb-1">
          <span
            className="text-xs px-3 py-1.5 font-medium w-full md:w-auto text-center"
            style={{ color: 'var(--color-fog)', backgroundColor: 'var(--color-stone-paper)', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-stone-line)' }}
          >
            {loading ? '—' : `${filtered.length} issue${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Loading State — skeleton cards */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-white p-4 animate-pulse">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-16 h-16 shrink-0" style={{ borderRadius: 'var(--radius-image)', backgroundColor: 'var(--color-stone-line)' }} />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between gap-2">
                    <div className="h-3.5 rounded w-3/5" style={{ backgroundColor: 'var(--color-stone-line)' }} />
                    <div className="h-4 rounded-full w-14 shrink-0" style={{ backgroundColor: 'var(--color-stone-paper)' }} />
                  </div>
                  <div className="h-3 rounded w-4/5" style={{ backgroundColor: 'var(--color-stone-paper)' }} />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-3 rounded w-16" style={{ backgroundColor: 'var(--color-stone-line)' }} />
                <div className="h-3 rounded w-12" style={{ backgroundColor: 'var(--color-stone-line)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="card-white p-12 text-center">
          <AlertCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--color-fog)' }} />
          <p className="font-medium" style={{ color: 'var(--color-fog)' }}>No issues match your filters</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-fog)' }}>Try adjusting the status or category filter above.</p>
        </div>
      )}

      {/* Issues Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onClick={() => navigate(`/issues/${issue.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
