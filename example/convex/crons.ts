import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";
import { registerDefaultAnalyticsCrons } from "@Abdssamie/convex-analytics";

const crons = cronJobs();

registerDefaultAnalyticsCrons(
  crons,
  {
    cleanupSite: internal.cleanup.site,
    pruneExpired: internal.cleanup.dedupes,
  },
  {
    slug: "default",
  },
);

export default crons;
