import { httpRouter } from "convex/server";
import { components } from "./_generated/api.js";
import { registerRoutes } from "@Abdssamie/convex-analytics";

const http = httpRouter();

registerRoutes(http, components.convexAnalytics, {
  path: "/analytics/ingest",
});

export default http;
