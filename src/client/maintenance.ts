import { cronJobs } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { ComponentApi } from "../component/_generated/component";

type RunActionCtx = {
	runAction: (
		ref: unknown,
		args: Record<string, unknown>,
	) => Promise<unknown>;
};

export async function runCleanupSite(
	ctx: RunActionCtx,
	component: ComponentApi,
	args: {
		siteId?: string;
		slug?: string;
		now?: number;
		limit?: number;
		runUntilComplete?: boolean;
	},
) {
	return await ctx.runAction(component.maintenance.cleanupSite, args);
}

export function registerDefaultAnalyticsCrons(
	crons: ReturnType<typeof cronJobs>,
	refs: {
		cleanupSite: FunctionReference<
			"mutation" | "action",
			"public" | "internal",
			{
				siteId?: string;
				slug?: string;
				now?: number;
				limit?: number;
				runUntilComplete?: boolean;
			}
		>;
	},
	options: {
		siteId?: string;
		slug?: string;
		namePrefix?: string;
		cleanupEveryHours?: number;
		limit?: number;
	} = {},
) {
	const prefix = options.namePrefix ?? "analytics";
	const cleanupEveryHours = options.cleanupEveryHours ?? 6;
	const limit = options.limit ?? 100;
	if (!options.siteId && !options.slug) {
		throw new Error("registerDefaultAnalyticsCrons requires siteId or slug");
	}

	crons.interval(
		`${prefix} cleanup`,
		{ hours: cleanupEveryHours },
		refs.cleanupSite,
		{
			siteId: options.siteId,
			slug: options.slug,
			limit,
			runUntilComplete: true,
		},
	);

	return crons;
}
