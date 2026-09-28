import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Navbar from './components/Navbar.jsx';
import { useFirstVisit } from './lib/useFirstVisit.js';

// Route code-splitting (Vercel React Best Practices: bundle-dynamic-imports)
const Dashboard       = lazy(() => import('./pages/Dashboard.jsx'));
const ReportWizard    = lazy(() => import('./pages/ReportWizard.jsx'));
const IssueDetail     = lazy(() => import('./pages/IssueDetail.jsx'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage.jsx'));
const IssuesList      = lazy(() => import('./pages/IssuesList.jsx'));
const AdminPage       = lazy(() => import('./pages/AdminPage.jsx'));
const LandingPage     = lazy(() => import('./pages/LandingPage.jsx'));

function RouteLoader() {
  return (
    <div
      className="min-h-screen pt-24 flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-stone-paper)' }}
    >
      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-plum)' }} />
    </div>
  );
}

export default function App() {
  // First-visit preference hook (?tour=true URL override supported)
  const { hasVisited, markVisited } = useFirstVisit();

  return (
    <BrowserRouter>
      {hasVisited && <Navbar />}
      <main className={hasVisited ? '' : 'overflow-hidden'}>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route
              path="/"
              element={
                hasVisited ? (
                  <Dashboard />
                ) : (
                  <LandingPage onGetStarted={markVisited} />
                )
              }
            />
            <Route path="/report"      element={<ReportWizard />} />
            <Route path="/issues"      element={<IssuesList />} />
            <Route path="/issues/:id"  element={<IssueDetail />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/admin"       element={<AdminPage />} />
          </Routes>
        </Suspense>
      </main>
    </BrowserRouter>
  );
}
