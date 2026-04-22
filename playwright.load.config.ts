import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./perf/playwright",
	timeout: 10 * 60 * 1000,
	expect: {
		timeout: 30_000,
	},
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-load" }]],
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
		browserName: "chromium",
		headless: true,
		trace: "retain-on-failure",
		video: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium-load",
			use: {
				...devices["Desktop Chrome"],
				browserName: "chromium",
			},
		},
	],
});
