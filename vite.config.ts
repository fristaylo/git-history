import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

export default defineConfig(({ mode }) => ({
	plugins: [react(), cssInjectedByJsPlugin()],
	define: {
		"process.env.NODE_ENV": JSON.stringify(
			mode === "production" ? "production" : "development"
		),
	},
	build: {
		outDir: "dist",
		emptyOutDir: false,
		sourcemap: mode !== "production",
		minify: mode === "production",
		cssCodeSplit: false,
		lib: {
			entry: "src/views/history/main.tsx",
			formats: ["iife"],
			name: "YummyGitHistoryView",
			fileName: () => "view.js",
		},
		rollupOptions: {
			output: {
				entryFileNames: "view.js",
				assetFileNames: "view.[ext]",
			},
		},
	},
}));
