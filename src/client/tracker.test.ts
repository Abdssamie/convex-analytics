import { afterEach, describe, expect, test, vi } from "vitest";
import { getBrowserContext, getBrowserReferrer } from "./browserContext";
import { createAnalytics } from "./tracker";
import { parseUA } from "./ua";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("tracker referrer handling", () => {
	test("drops same-origin referrers", () => {
		vi.stubGlobal("location", { origin: "http://localhost:5173" });
		vi.stubGlobal("document", {
			referrer: "http://localhost:5173/dashboard",
		});

		expect(getBrowserReferrer()).toBeUndefined();
	});

	test("keeps cross-origin referrers", () => {
		vi.stubGlobal("location", { origin: "http://localhost:5173" });
		vi.stubGlobal("document", {
			referrer: "https://google.com/search?q=convex",
		});

		expect(getBrowserReferrer()).toBe("https://google.com/search?q=convex");
	});
});

describe("tracker browser context", () => {
	test("does not start a flush timer outside the browser", () => {
		vi.stubGlobal("window", undefined);
		const setIntervalSpy = vi
			.spyOn(globalThis, "setInterval")
			.mockImplementation(() => 0 as unknown as ReturnType<typeof setInterval>);

		const client = createAnalytics({
			endpoint: "https://example.com/ingest",
			writeKey: "write_test",
		});

		expect(setIntervalSpy).not.toHaveBeenCalled();
		client.stop();
	});

	test("captures browser, os, device, and utm fields", () => {
		vi.stubGlobal("window", {
			location: {
				search: "?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
			},
			navigator: {
				userAgent:
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
			},
		});

		expect(getBrowserContext()).toEqual({
			device: "Desktop",
			browser: "Chrome",
			os: "macOS",
			utmSource: "newsletter",
			utmMedium: "email",
			utmCampaign: "launch",
		});
	});
});

describe("ua parser", () => {
	test("classifies mobile safari", () => {
		expect(
			parseUA(
				"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
			),
		).toEqual({
			browser: "Safari",
			os: "iOS",
			device: "Mobile",
		});
	});
});
