#!/usr/bin/env node
import "../src/env.js";
import { runFullClipping } from "../src/run.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const daysArg = args.find((a) => a.startsWith("--days="));
const days = daysArg ? parseInt(daysArg.split("=")[1], 10) : 7;

try {
  const summary = await runFullClipping({ days, dryRun });
  console.log("\n📊 Resumen:");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
} catch (err) {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
}
