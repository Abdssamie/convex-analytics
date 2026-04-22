import "./App.css";
import { createAnalytics } from "@Abdssamie/convex-analytics";
import { AnalyticsDashboard } from "@Abdssamie/convex-analytics/react";
import { useQuery } from "convex/react";
import { useMemo, useState, useEffect } from "react";
import { api } from "../convex/_generated/api";
import { installAnalyticsLoadHarness } from "./loadHarness";

const writeKey = import.meta.env.VITE_ANALYTICS_WRITE_KEY ?? "write_demo_local";

function DashboardView(props: { onBack: () => void }) {
  const site = useQuery(api.example.getSiteBySlug, { slug: "default" });

  return (
    <main className="shell">
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button onClick={props.onBack}>← Back to Demo</button>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Connected to site: <strong>{site?.slug ?? "..."}</strong>
        </p>
      </div>
      {site ? (
        <AnalyticsDashboard
          siteId={site._id}
          api={{
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
          }}
        />
      ) : site === null ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
          Run <code>npx convex run example:setupDefaultSite</code> once.
        </div>
      ) : (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
          Loading site configuration...
        </div>
      )}
    </main>
  );
}

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [plan, setPlan] = useState<"starter" | "pro">("starter");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("No event sent yet.");
  const site = useQuery(api.example.getSiteBySlug, { slug: "default" });

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  };

  const analytics = useMemo(() => {
    const endpoint = import.meta.env.VITE_CONVEX_URL.replace(
      ".cloud",
      ".site",
    ).replace(/\/$/, "");

    return createAnalytics({
      endpoint: `${endpoint}/analytics/ingest`,
      writeKey,
      autoPageviews: true,
    });
  }, []);

  useEffect(() => {
    installAnalyticsLoadHarness(analytics, {
      enabled: import.meta.env.VITE_ENABLE_LOAD_HARNESS === "true",
      endpointPath: "/analytics/ingest",
    });
  }, [analytics]);

  function selectPlan(nextPlan: "starter" | "pro") {
    setPlan(nextPlan);
    analytics.track("plan_selected", { plan: nextPlan });
    setMessage(`Tracked plan_selected: ${nextPlan}`);
  }

  function startTrial() {
    analytics.track("trial_started", { plan });
    setMessage(`Tracked trial_started: ${plan}`);
  }

  function identifyVisitor() {
    if (!email.trim()) {
      setMessage("Enter email first.");
      return;
    }
    analytics.identify(email.trim(), { selectedPlan: plan });
    setMessage(`Tracked identify for ${email.trim()}`);
  }

  if (path === "/dashboard") {
    return <DashboardView onBack={() => navigate("/")} />;
  }

  return (
    <main className="shell">
      <nav
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <button onClick={() => navigate("/dashboard")}>
          View Analytics Dashboard →
        </button>
      </nav>
      {site === null ? (
        <p className="status">
          Setup missing. Run{" "}
          <code>npx convex run example:setupDefaultSite</code> once.
        </p>
      ) : null}
      <section className="hero">
        <p className="eyebrow">Tracked Example App</p>
        <h1>Launch a tiny product workspace.</h1>
        <p className="lede">
          This app is not an analytics dashboard. It behaves like a product app
          and sends pageviews, plan selections, trial starts, and identify calls
          into the Convex analytics component.
        </p>

        <div className="plans" aria-label="Plans">
          <button
            className={plan === "starter" ? "selected" : ""}
            onClick={() => selectPlan("starter")}
          >
            Starter
          </button>
          <button
            className={plan === "pro" ? "selected" : ""}
            onClick={() => selectPlan("pro")}
          >
            Pro
          </button>
        </div>

        <div className="signup">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="founder@example.com"
            type="email"
          />
          <button onClick={identifyVisitor}>Identify</button>
        </div>

        <button className="primary" onClick={startTrial}>
          Start Trial
        </button>
        <p className="status">{message}</p>
      </section>

      <section className="product">
        <article>
          <span>01</span>
          <h2>Capture ideas</h2>
          <p>Track what users do while they move through real app flows.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Invite team</h2>
          <p>Use custom events for product actions that matter to you.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Ship faster</h2>
          <p>Inspect component tables and functions from Convex dashboard.</p>
        </article>
      </section>
    </main>
  );
}

export default App;
