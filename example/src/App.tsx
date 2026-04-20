import "./App.css";
import { createAnalytics } from "@Abdssamie/convex-analytics";
import { useMemo, useState } from "react";

const writeKey = import.meta.env.VITE_ANALYTICS_WRITE_KEY ?? "write_demo_local";

function App() {
  const [plan, setPlan] = useState<"starter" | "pro">("starter");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("No event sent yet.");

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

  return (
    <main className="shell">
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
