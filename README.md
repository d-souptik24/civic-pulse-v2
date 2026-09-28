<div align="center">

<img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
<img src="https://img.shields.io/badge/Gemini-3.1_Flash_Lite-8E75B2?style=for-the-badge&logo=google&logoColor=white" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Leaflet-1.9-199900?style=for-the-badge&logo=leaflet&logoColor=white" />
<img src="https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white" />

<br /><br />

# 🌐 CivicPulse

### AI-Powered Civic Issue Reporting & Resolution Platform

_Built for the Vibe2Ship Hackathon — Problem Statement 2: Community Hero_

<br />

[![Live Demo](https://img.shields.io/badge/Live_Demo-civic--pulse--in.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://civic-pulse-in.vercel.app)
[![API Health](https://img.shields.io/badge/API_Health-Active-3ECF8E?style=for-the-badge&logo=statuspage&logoColor=white)](https://civic-pulse-in.vercel.app/api/health)
[![Supabase Keep-Alive](https://github.com/d-souptik24/civic-pulse-v2/actions/workflows/keep-alive.yml/badge.svg)](https://github.com/d-souptik24/civic-pulse-v2/actions/workflows/keep-alive.yml)

<br />

**🚀 Experience it live:** [https://civic-pulse-in.vercel.app](https://civic-pulse-in.vercel.app)

</div>

---

## 🏙️ The Problem

Every city has them — potholes that never get fixed, streetlights that stay broken for months, water leaks that go unnoticed. Citizens have no easy way to report these issues, no visibility into whether their reports were heard, and no way to hold authorities accountable.

Traditional complaint portals are slow, opaque, and disconnected from the community. Reports get lost. Nothing gets fixed.

---

## 💡 The Solution — CivicPulse

CivicPulse is a community-first platform where citizens can photograph a civic problem and submit it in seconds. From that moment, five AI pipelines take over — verifying the issue is real, preventing duplicates, tracking it on a live map, escalating it if ignored, and confirming it's actually fixed.

Every issue has a full public lifecycle. The community sees it, upvotes it, and watches it get resolved in real time.

---

## 🤖 The 5 AI Pipelines

| #     | Pipeline                                       | What it Does                                                                                                                                                                       |
| ----- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Vision Categorizer & Authenticity Verifier** | Analyses the uploaded photo using Gemini's multimodal vision to auto-detect the issue type and severity, and verifies the photo is a real civic problem — not a duplicate or fake. |
| **2** | **Geo-Deduplication Agent**                    | Before creating a new report, scans a 200-metre radius to check if the same issue already exists nearby. If found, the citizen is prompted to upvote the existing report instead.  |
| **3** | **Predictive Hotspot Mapper**                  | Clusters open issues by location and generates plain-English AI insights — _"Northern sector has 5 open potholes — high risk of vehicle damage"_ — surfaced on the live dashboard. |
| **4** | **Autonomous Escalation Agent**                | Admins can trigger the agent from the dashboard, which then scans all unresolved issues older than 24 hours and generates formal escalation summaries, updating their status to escalated. |
| **5** | **AI Resolution Verifier**                     | When a fix is submitted, Gemini compares the before and after photos. If the issue is confirmed resolved, the ticket auto-closes and the reporter earns community points.          |

---

## 🎯 How It Works — The Citizen Flow

1. **Snap or upload a photo** of a civic problem (pothole, broken streetlight, waste dump, water leak).
2. **AI analyses it** — Gemini detects category, severity, and verifies authentic civic evidence.
3. **Smart 4-tier location tagging:**
   - **Tier 1 (Photo EXIF):** Automatically reads embedded GPS coordinates from the photo's EXIF data.
   - **Tier 2 (Device GPS):** Falls back to browser geolocation if photo metadata is missing.
   - **Tier 3 (Address Search):** Search any locality or street via OpenStreetMap Nominatim with instant map fly-to.
   - **Tier 4 (Interactive Pin):** Manual drag-and-drop pinpointing anywhere on the map.
4. **Instant geo-deduplication check** — PostGIS queries a 200m radius to prevent duplicate tickets before saving.
5. **Submit & track live** — The issue appears immediately on the public map.
6. **Community upvotes** prioritize urgent local issues.
7. **Resolution with AI proof** — Citizens or authorities submit a fix photo; Gemini compares before/after photos to confirm the fix before closing.

---

## 📱 Pages

| Page             | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| **Landing Page** | Platform entry point, interactive walkthrough, live stats overview, and project info |
| **Dashboard**    | Live issue map, stats, AI hotspot insights, recent activity |
| **Report**       | Three-step wizard — photo, smart location, review & submit  |
| **Issues**       | Full list, filterable by category, status, and area         |
| **Issue Detail** | Complete timeline, upvotes, dual-vision resolution proof    |
| **Leaderboard**  | Top contributing citizens, points, and badges               |
| **Admin Panel**  | Platform-wide analytics, escalation agent trigger, and status management |

---

## 👥 Roles & Permissions

The application implements a secure role-based access control (RBAC) model split into three distinct user tiers:

*   **Public (Unauthenticated):** Browse interactive map, view issue details, track status history, and view the community leaderboard.
*   **Authenticated Citizens:** Report issues with smart location, upvote open reports, and submit resolution photos with AI verification.
*   **Administrators:** Securely manage issue lifecycles, change statuses, and trigger the Autonomous Escalation Agent.

---

## 🏆 Gamification & Leaderboard

To encourage community engagement, CivicPulse rewards active participation with point and badge incentives:
*   **Issue Reporting:** Citizens earn **50 points** for reporting, with a **25-point bonus** (total 75 points) when Gemini confirms photo authenticity.
*   **Community Support:** Upvoting a critical local issue awards the reporter **10 points** to promote community validation. Removing an upvote adjusts points fairly.
*   **AI Resolutions:** Uploading a fix photo that passes Gemini dual-vision comparison awards **100 points** and closes the issue.
*   **Badges:** Category achievements (*Pothole Patrol*, *Water Warden*, *Light Keeper*, *Community Hero*) unlock upon reaching milestone thresholds.

---

## 🛡️ Security Architecture

*   **Row-Level Security (RLS):** Direct client-side access is secured by PostgreSQL RLS policies in Supabase.
*   **Cryptographic Verification:** Express middleware validates Supabase JWTs cryptographically via `supabase.auth.getUser()`.
*   **Privileged Backend:** Sensitive mutations run through Express using the Supabase Service Role Key.
*   **Storage Access Control:** Supabase Storage bucket policies enforce file-type boundaries and authentication requirements.
*   **Rate Limiting:** Express routes are guarded by rate limiters to prevent DDoS and runaway AI token costs.

---

## 📂 Project Structure

```text
├── client/                 # Frontend SPA (React 19 + Vite + Leaflet)
│   ├── src/
│   │   ├── components/     # Map, Navbar, Wizard steps, UI elements
│   │   ├── hooks/          # Custom hooks (typewriter, etc.)
│   │   ├── lib/            # Supabase client, AuthContext, API client
│   │   ├── pages/          # Landing, Dashboard, Report, Issues, Admin, Leaderboard
│   │   └── index.css       # Design token system (Vanilla CSS)
├── server/                 # Express backend API & AI pipelines
│   ├── routes/             # Issues, analyze, insights, escalate, verify
│   ├── middleware/         # JWT auth & admin guard
│   ├── lib/                # Supabase server client & token verification
│   └── app.js              # Express app & /api/health endpoint
├── api/                    # Vercel serverless function entry (api/index.js)
├── .github/workflows/      # Automated keep-alive cron job for Supabase DB
└── vercel.json             # Vercel deployment configuration
```

---

## 🛠️ Built With

- **Gemini 3.1 Flash Lite** — Multimodal vision analysis, authenticity verification, and dual-vision resolution checks
- **Supabase & PostgreSQL + PostGIS** — Relational database, geospatial queries (`ST_DWithin`), and auth
- **Leaflet & OpenStreetMap** — Interactive live map with custom status markers and Nominatim address search
- **React 19 + Vite** — High-performance modern UI with client-side routing
- **Vanilla CSS Tokens** — Custom design system without heavy framework runtime overhead
- **Node.js + Express 5** — Backend REST API with Vercel serverless adapter

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- **Node.js** 20+ installed
- A **Supabase** project (with PostGIS extension enabled)
- A **Google Gemini API Key** (from Google AI Studio)

### 2. Environment Variables

Create `server/.env`:
```env
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Create `client/.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Install & Run

In the **server** directory:
```bash
cd server
npm install
npm run dev     # Runs on http://localhost:3001
```

In the **client** directory (in a second terminal):
```bash
cd client
npm install
npm run dev     # Runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## 🌐 Deployment & Keep-Alive

- **Live Production URL:** [https://civic-pulse-in.vercel.app](https://civic-pulse-in.vercel.app)
- **Production API Health Check:** [https://civic-pulse-in.vercel.app/api/health](https://civic-pulse-in.vercel.app/api/health)
- **Deployment Platform:** Deployed seamlessly on **Vercel** with global edge CDN for static assets and serverless execution for `/api/*` Express routes via `vercel.json` and `api/index.js`.
- **Database Keep-Alive Automation:** Automated via GitHub Actions ([`.github/workflows/keep-alive.yml`](.github/workflows/keep-alive.yml)) running on a cron schedule (`0 0 */3 * *`) to ping the Supabase PostgreSQL database and ensure zero free-tier dormancy.

---

## 📄 License

MIT © Souptik Dutta
