import { httpRouter } from "convex/server";
import { components } from "./_generated/api.js";
import { registerRoutes } from "@Abdssamie/convex-analytics";

const http = httpRouter();

registerRoutes(http, components.convexAnalytics, {
  path: "/analytics/ingest",
  sites: [
    {
      slug: "default",
      name: "Default site",
      writeKey: process.env.ANALYTICS_WRITE_KEY ?? "write_demo_local",
      allowedOrigins: [],
    },
  ],
});

export default http;
