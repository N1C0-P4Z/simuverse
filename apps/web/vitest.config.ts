import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "app/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:5001/api",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
      NEXT_PUBLIC_CERTIFICATE_ISSUER_NAME: "Test Issuer",
      NEXT_PUBLIC_PWA_ENABLED: "true",
      NEXT_PUBLIC_DEBUG_LOG: "false",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@simuverse/shared": path.resolve(__dirname, "../shared/src/file-upload"),
    },
  },
});
