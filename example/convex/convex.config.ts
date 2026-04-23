import { defineApp } from "convex/server";
import convexAnalytics from "../../src/component/convex.config.js";

const app = defineApp();
app.use(convexAnalytics, { httpPrefix: "/analytics-component/" });

export default app;
