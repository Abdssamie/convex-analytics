import "./App.css";
import { createAnalytics } from "../../src/client/index.js";
import { AnalyticsDashboard } from "../../src/react/index.js";
import { useQuery } from "convex/react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { api } from "../convex/_generated/api";
import { installAnalyticsLoadHarness } from "./loadHarness";

const writeKey = import.meta.env.VITE_ANALYTICS_WRITE_KEY ?? "write_demo_local";

// ─── types ───────────────────────────────────────────────────────────────────

type EventEntry = {
  id: number;
  type: "page" | "track" | "identify";
  label: string;
  ts: string;
};

type PlanKey = "starter" | "pro";

let _eid = 0;

// ─── feature data ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2L3 7v6l7 4 7-4V7L10 2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="10" r="2" fill="currentColor" />
      </svg>
    ),
    title: "Realtime Ingestion",
    desc: "Events land in your Convex database via a fast HTTP endpoint. Subscriptions push updates to your dashboard the moment data arrives.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="11" width="3" height="7" rx="1" fill="currentColor" />
        <rect x="7" y="7" width="3" height="11" rx="1" fill="currentColor" />
        <rect x="12" y="4" width="3" height="14" rx="1" fill="currentColor" />
        <rect
          x="17"
          y="9"
          width="1"
          height="9"
          rx="0.5"
          fill="currentColor"
          opacity="0.4"
        />
      </svg>
    ),
    title: "Drop-in Dashboard",
    desc: "A complete React component with timeseries charts, breakdowns, and tables. Import and render in minutes, no configuration needed.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect
          x="4"
          y="4"
          width="12"
          height="12"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 10l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "First-party Data",
    desc: "No third-party analytics services. All data lives in your own Convex deployment — under your control, in your database.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 6v4l3 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Browser SDK",
    desc: "Auto-pageviews, batched events, anonymous sessions, and user identity — handled by a tiny, dependency-free browser client.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 3c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Sessions & Visitors",
    desc: "Automatic anonymous visitor deduplication and session grouping — built into the ingestion pipeline with no extra setup.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 10h12M10 4v12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    title: "Cost Controls",
    desc: "Configure data retention windows and event sampling rates. Keep only what you need, at Convex storage and compute speeds.",
  },
];

// ─── agent prompt ─────────────────────────────────────────────────────────────

const AGENT_PROMPT = `Implement the @abdssamie/convex-analytics Convex component in this project.

Full README: https://github.com/abdssamie/convex-analytics

STEP 1 — Install
npm install @abdssamie/convex-analytics

STEP 2 — convex/convex.config.ts (register the component)
import { defineApp } from "convex/server";
import convexAnalytics from "@abdssamie/convex-analytics/convex.config.js";
const app = defineApp();
app.use(convexAnalytics, { httpPrefix: "/analytics-component/" });
export default app;

STEP 3 — convex/http.ts (register the ingest HTTP route)
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { registerRoutes } from "@abdssamie/convex-analytics";
const http = httpRouter();
registerRoutes(http, components.convexAnalytics);
export default http;

STEP 4 — convex/analytics.ts (expose API + provision mutation)
import { components } from "./_generated/api";
import { provisionSite, exposeAdminApi, exposeAnalyticsApi } from "@abdssamie/convex-analytics";

export const provisionDefaultSite = provisionSite(components.convexAnalytics, {
  auth: async () => {},
  site: {
    slug: "default",
    name: "Default site",
    writeKey: process.env.ANALYTICS_WRITE_KEY!,
    allowedOrigins: [],
  },
});

export const { getSiteBySlug } = exposeAdminApi(components.convexAnalytics, {
  auth: async () => {},
});

export const {
  getDashboardSummary, getOverview, getTimeseries,
  getTopPages, getTopReferrers, getTopSources, getTopMediums,
  getTopCampaigns, getTopEvents, getTopDevices, getTopBrowsers,
  getTopOs, getTopCountries, listRawEvents, listPageviews,
  listSessions, listVisitors,
} = exposeAnalyticsApi(components.convexAnalytics, { auth: async () => {} });

STEP 5 — Set env var + provision once
# Add ANALYTICS_WRITE_KEY to your Convex environment variables
npx convex run analytics:provisionDefaultSite

STEP 6 — Frontend: browser SDK
import { createAnalytics } from "@abdssamie/convex-analytics";
const analytics = createAnalytics({
  endpoint: process.env.NEXT_PUBLIC_CONVEX_URL.replace(".cloud", ".site") + "/analytics/ingest",
  writeKey: process.env.NEXT_PUBLIC_ANALYTICS_WRITE_KEY!,
  autoPageviews: true,
});
// Then call: analytics.track("event_name", { key: "value" })
//            analytics.identify("user_id", { plan: "pro" })

STEP 7 — Frontend: render the dashboard
import { AnalyticsDashboard } from "@abdssamie/convex-analytics/react";
import { useQuery } from "convex/react";

const site = useQuery(api.analytics.getSiteBySlug, { slug: "default" });

<AnalyticsDashboard
  siteId={site._id}
  api={{
    getDashboardSummary: api.analytics.getDashboardSummary,
    getOverview: api.analytics.getOverview,
    getTimeseries: api.analytics.getTimeseries,
    getTopPages: api.analytics.getTopPages,
    getTopReferrers: api.analytics.getTopReferrers,
    getTopSources: api.analytics.getTopSources,
    getTopMediums: api.analytics.getTopMediums,
    getTopCampaigns: api.analytics.getTopCampaigns,
    getTopEvents: api.analytics.getTopEvents,
    getTopDevices: api.analytics.getTopDevices,
    getTopBrowsers: api.analytics.getTopBrowsers,
    getTopOs: api.analytics.getTopOs,
    getTopCountries: api.analytics.getTopCountries,
    listRawEvents: api.analytics.listRawEvents,
    listPageviews: api.analytics.listPageviews,
    listSessions: api.analytics.listSessions,
    listVisitors: api.analytics.listVisitors,
  }}
/>`;

// ─── icons ────────────────────────────────────────────────────────────────────

function HexIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M9 1.5L16 5.5v7L9 16.5 2 12.5v-7L9 1.5z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="9" cy="9" r="2" fill="currentColor" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331z" />
    </svg>
  );
}

// ─── shared api object ────────────────────────────────────────────────────────

const DASHBOARD_API = {
  getDashboardSummary: api.example.getDashboardSummary,
  getOverview: api.example.getOverview,
  getTimeseries: api.example.getTimeseries,
  getTopPages: api.example.getTopPages,
  getTopReferrers: api.example.getTopReferrers,
  getTopSources: api.example.getTopSources,
  getTopMediums: api.example.getTopMediums,
  getTopCampaigns: api.example.getTopCampaigns,
  getTopEvents: api.example.getTopEvents,
  getTopDevices: api.example.getTopDevices,
  getTopBrowsers: api.example.getTopBrowsers,
  getTopOs: api.example.getTopOs,
  getTopCountries: api.example.getTopCountries,
  listRawEvents: api.example.listRawEvents,
  listPageviews: api.example.listPageviews,
  listSessions: api.example.listSessions,
  listVisitors: api.example.listVisitors,
};

// ─── DashboardView (full page) ────────────────────────────────────────────────

function DashboardView({ onBack }: { onBack: () => void }) {
  const site = useQuery(api.example.getSiteBySlug, { slug: "default" });

  return (
    <div className="dash-page">
      <div className="dash-topbar">
        <button className="dash-back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="dash-topbar-title">
          <span className="live-pip" />
          Analytics Dashboard
        </div>
        <span className="dash-topbar-meta">
          site: <strong>{site?.slug ?? "…"}</strong>
        </span>
      </div>

      {site === undefined && (
        <div className="state-overlay">
          <div className="spinner" />
          <p>Connecting to Convex…</p>
        </div>
      )}
      {site === null && (
        <div className="state-overlay">
          <p className="state-label">Site not initialized.</p>
          <code className="state-code">
            npx convex run example:setupDefaultSite
          </code>
        </div>
      )}
      {site && (
        <AnalyticsDashboard
          siteId={site._id}
          style={{ height: "calc(100vh - 60px)" }}
          api={DASHBOARD_API}
        />
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [plan, setPlan] = useState<PlanKey>("starter");
  const [promptCopied, setPromptCopied] = useState(false);
  const [feed, setFeed] = useState<EventEntry[]>([]);
  const site = useQuery(api.example.getSiteBySlug, { slug: "default" });

  // routing
  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  }, []);

  // analytics client
  const analytics = useMemo(() => {
    const endpoint = import.meta.env.VITE_CONVEX_URL.replace(
      ".cloud",
      ".site",
    ).replace(/\/$/, "");
    return createAnalytics({
      endpoint: `${endpoint}/analytics/ingest`,
      writeKey,
      autoPageviews: false,
    });
  }, []);

  useEffect(() => {
    analytics.page();
  }, [analytics, path]);

  useEffect(() => {
    installAnalyticsLoadHarness(analytics, {
      enabled: import.meta.env.VITE_ENABLE_LOAD_HARNESS === "true",
      endpointPath: "/analytics/ingest",
    });
  }, [analytics]);

  // event feed helper
  function pushFeed(type: EventEntry["type"], label: string) {
    const ts = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setFeed((prev) => [{ id: ++_eid, type, label, ts }, ...prev].slice(0, 3));
  }

  // handlers
  function selectPlan(p: PlanKey) {
    setPlan(p);
    analytics.track("plan_selected", { plan: p });
    pushFeed("track", `plan_selected { plan: "${p}" }`);
  }

  function startTrial() {
    analytics.track("trial_started", { plan });
    pushFeed("track", `trial_started { plan: "${plan}" }`);
  }

  function copyPrompt() {
    navigator.clipboard
      .writeText(AGENT_PROMPT)
      .then(() => {
        setPromptCopied(true);
        setTimeout(() => setPromptCopied(false), 2500);
      })
      .catch(() => {});
  }

  // dashboard full page
  if (path === "/dashboard") {
    return <DashboardView onBack={() => navigate("/")} />;
  }

  // landing page
  return (
    <div className="page">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <a
          className="nav-brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <HexIcon />
          <span className="brand-name">
            convex<span className="brand-accent">-analytics</span>
          </span>
        </a>

        <div className="nav-links">
          <a
            className="nav-link"
            href="https://github.com/abdssamie/convex-analytics"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon />
            GitHub
          </a>
          <a
            className="nav-link"
            href="https://www.npmjs.com/package/@abdssamie/convex-analytics"
            target="_blank"
            rel="noopener noreferrer"
          >
            <NpmIcon />
            npm
          </a>
          <a
            className="nav-link"
            href="https://www.convex.dev/components/convex-analytics"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HexIcon />
            Convex Component
          </a>

          <button className="nav-copy-btn" onClick={copyPrompt}>
            <CopyIcon />
            {promptCopied ? "Prompt Copied" : "Copy Agent Prompt"}
          </button>

          <button className="nav-cta" onClick={() => navigate("/dashboard")}>
            Dashboard →
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        {/* Left column */}
        <div className="hero-left">
          <h1 className="hero-h1">
            Real-time analytics,
            <br />
            <span className="h1-accent">built into Convex.</span>
          </h1>

          <p className="hero-sub">
            First-party product analytics as a Convex component — events,
            sessions, and a live dashboard in your own database.
          </p>

          <p className="interact-hint">
            → Click below — dashboard updates after a short ingest delay as
            events are batched and flushed async by Convex.
          </p>

          <div className="plan-tabs">
            <button
              className={`plan-btn${plan === "starter" ? " plan-active" : ""}`}
              onClick={() => selectPlan("starter")}
            >
              Starter
            </button>
            <button
              className={`plan-btn${plan === "pro" ? " plan-active" : ""}`}
              onClick={() => selectPlan("pro")}
            >
              Pro
            </button>
          </div>

          <button className="trial-btn" onClick={startTrial}>
            Start Trial →
          </button>

          <div className="event-feed">
            {feed.length === 0 ? (
              <span className="feed-empty">
                Event stream will appear here after first interaction…
              </span>
            ) : (
              feed.map((ev) => (
                <div key={ev.id} className="feed-row">
                  <span className={`feed-badge feed-${ev.type}`}>
                    {ev.type}
                  </span>
                  <span className="feed-label">{ev.label}</span>
                  <span className="feed-ts">{ev.ts}</span>
                </div>
              ))
            )}
          </div>

          {site === null && (
            <div className="setup-notice">
              ⚠ Run <code>npx convex run example:setupDefaultSite</code> once to
              activate.
            </div>
          )}
        </div>

        {/* Right column — live dashboard */}
        <div className="hero-right">
          <div className="dash-frame">
            <div className="frame-chrome">
              <div className="chrome-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green-dot" />
              </div>
              <span className="chrome-title">analytics dashboard</span>
              <span className="chrome-live">
                <span className="live-pip" />
                LIVE
              </span>
            </div>
            <div className="frame-body">
              {site === undefined && (
                <div className="frame-state">
                  <div className="spinner" />
                  <span>Connecting to Convex…</span>
                </div>
              )}
              {site === null && (
                <div className="frame-state">
                  <span>Run setup command to initialize:</span>
                  <code>npx convex run example:setupDefaultSite</code>
                </div>
              )}
              {site && (
                <AnalyticsDashboard
                  siteId={site._id}
                  style={{ height: "100%" }}
                  api={DASHBOARD_API}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features">
        <div className="features-inner">
          <span className="section-tag">Features</span>
          <h2 className="features-h2">
            Built for developers
            <br />
            who own their data.
          </h2>
          <p className="features-sub">
            Everything you need for product analytics, packaged as a Convex
            component. No vendor lock-in. No extra services. Just Convex.
          </p>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div className="feat-card" key={f.title}>
                <div className="feat-icon">{f.icon}</div>
                <h3 className="feat-title">{f.title}</h3>
                <p className="feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand">
            <HexIcon />
            convex-analytics
          </span>
          <span className="footer-sep">·</span>
          <span className="footer-note">MIT License · Built with Convex</span>
          <div className="footer-right">
            <a
              href="https://github.com/abdssamie/convex-analytics"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <GitHubIcon />
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/@abdssamie/convex-analytics"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <NpmIcon />
              npm
            </a>
            <a
              href="https://www.convex.dev/components/convex-analytics"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <HexIcon />
              Convex Component
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
