import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import "@testing-library/jest-dom";

// Load .env.test if it exists (for integration test credentials)
const envPath = resolve(process.cwd(), ".env.test");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
