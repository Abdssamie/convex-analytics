import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";
import { registerDefaultAnalyticsCrons } from "../../src/client/index.js";

const crons = cronJobs();

registerDefaultAnalyticsCrons(
  crons,
  {
    cleanupSite: internal.cleanup.site,
  },
  {
    slug: "default",
  },
);

export default crons;
