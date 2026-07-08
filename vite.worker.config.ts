import { builtinModules } from "node:module";
import swc from "unplugin-swc";
import { defineConfig } from "vite";

const external = [
	"vscode",
	...builtinModules,
	...builtinModules.map((name) => `node:${name}`),
];

export default defineConfig(({ mode }) => ({
	plugins: [
		swc.vite({
			jsc: {
				parser: { syntax: "typescript", decorators: true },
				transform: { legacyDecorator: true, decoratorMetadata: true },
				target: "es2021",
				keepClassNames: true,
			},
		}),
	],
	ssr: {
		noExternal: true,
	},
	build: {
		outDir: "dist",
		emptyOutDir: false,
		target: "node18",
		ssr: "src/git/worker.ts",
		sourcemap: mode !== "production",
		minify: mode === "production",
		rollupOptions: {
			external,
			output: {
				format: "cjs",
				entryFileNames: "worker.js",
				exports: "named",
			},
		},
	},
}));
