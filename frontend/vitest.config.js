import { defineConfig } from "vitest/config"; // https://vitest.dev/config/

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		clearMocks: true,
		restoreMocks: true,

		include: [
			"**/*_test.js",
		],
	},
});