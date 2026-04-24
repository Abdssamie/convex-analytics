import { resolve } from "node:path";
import { build } from "vite";

await build({
	logLevel: "info",
	build: {
		lib: {
			entry: resolve("src/client/embed.ts"),
			name: "ConvexAnalytics",
			formats: ["iife"],
			fileName: () => "convex-analytics.js",
		},
		outDir: resolve("dist/embed"),
		emptyOutDir: false,
		sourcemap: true,
		minify: true,
	},
});
