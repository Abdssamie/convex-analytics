import { httpRouter } from "convex/server";
import { components } from "./_generated/api.js";
import { registerRoutes } from "../../src/client/index.js";

const http = httpRouter();

registerRoutes(http, components.convexAnalytics, {
  path: "/analytics/ingest",
});

export default http;
