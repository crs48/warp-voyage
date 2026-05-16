import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
