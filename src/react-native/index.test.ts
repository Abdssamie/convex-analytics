import { afterEach, describe, expect, test, vi } from "vitest";
import { createRnAnalytics } from "./index";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("react native analytics", () => {
	test("hydrates persisted async storage before creating identities", async () => {
		const stored = new Map<string, string>([
			["convex_analytics_visitor_id", "visitor_existing"],
			["convex_analytics_session_id", "session_existing"],
			["convex_analytics_session_seen_at", `${Date.now()}`],
		]);
		const setItem = vi.fn(async (key: string, value: string) => {
			stored.set(key, value);
		});
		vi.spyOn(globalThis, "setInterval").mockImplementation(
			() => 0 as unknown as ReturnType<typeof setInterval>,
		);
		const fetch = vi.fn(
			async (_input: string | URL | Request, _init?: RequestInit) =>
				({ ok: true }) as Response,
		);
		vi.stubGlobal("fetch", fetch);

		const analytics = await createRnAnalytics({
			endpoint: "https://example.com/ingest",
			writeKey: "write_test",
			storage: {
				getItem: async (key: string) => stored.get(key) ?? null,
				setItem,
			},
		});

		analytics.track("screen_view", { screen: "Home" });
		await analytics.flush();
		analytics.stop();

		const [, init] = fetch.mock.calls[0];
		const body = JSON.parse(init?.body as string);
		expect(body.visitorId).toBe("visitor_existing");
		expect(body.sessionId).toBe("session_existing");
		expect(setItem).not.toHaveBeenCalledWith(
			"convex_analytics_visitor_id",
			expect.any(String),
		);
	});
});
