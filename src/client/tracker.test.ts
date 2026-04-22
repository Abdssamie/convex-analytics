import { afterEach, describe, expect, test, vi } from "vitest";
import { browserContext, externalReferrer } from "./tracker";
import { parseUA } from "./ua";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("tracker referrer handling", () => {
	test("drops same-origin referrers", () => {
		vi.stubGlobal("location", { origin: "http://localhost:5173" });
		vi.stubGlobal("document", {
			referrer: "http://localhost:5173/dashboard",
		});

		expect(externalReferrer()).toBeUndefined();
	});

	test("keeps cross-origin referrers", () => {
		vi.stubGlobal("location", { origin: "http://localhost:5173" });
		vi.stubGlobal("document", {
			referrer: "https://google.com/search?q=convex",
		});

		expect(externalReferrer()).toBe("https://google.com/search?q=convex");
	});
});

describe("tracker browser context", () => {
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

		expect(browserContext()).toEqual({
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
