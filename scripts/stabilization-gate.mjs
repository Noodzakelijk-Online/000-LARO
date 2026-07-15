#!/usr/bin/env node
/**
 * Run release quality gates in a fixed, fail-fast order.
 *
 * Gates:
 *   1. server typecheck
 *   2. Electron main-process typecheck
 *   3. renderer typecheck and lint
 *   4. traceability report
 *   5. runtime and account safety scans
 *   6. Vitest suite
 */
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");
const VITEST = join(ROOT, "node_modules", "vitest", "vitest.mjs");
const NPM_CLI = process.env.npm_execpath;

if (!NPM_CLI) {
  console.error("Run this gate through npm so the native rebuild uses the active Node toolchain.");
  process.exit(1);
}

const BLOCKING = [
  { name: "Node native-module rebuild", cmd: process.execPath, args: [NPM_CLI, "rebuild", "better-sqlite3"] },
  { name: "server typecheck", cmd: process.execPath, args: [TSC, "-p", "tsconfig.server.json", "--noEmit"] },
  { name: "main typecheck", cmd: process.execPath, args: [TSC, "-p", "tsconfig.main.json", "--noEmit"] },
  { name: "renderer typecheck", cmd: process.execPath, args: [TSC, "-p", "tsconfig.renderer.json", "--noEmit"] },
  { name: "lint", cmd: process.execPath, args: [NPM_CLI, "run", "lint", "--silent"] },
  { name: "traceability", cmd: process.execPath, args: ["scripts/traceability.mjs", "--write"] },
  { name: "no-excuses scan", cmd: process.execPath, args: ["scripts/no-excuses-scan.mjs", "--write"] },
  { name: "account safety", cmd: process.execPath, args: ["scripts/account-safety-check.mjs", "--write"] },
  { name: "tests", cmd: process.execPath, args: [VITEST, "run"] },
];

function run(step) {
  process.stdout.write(`\n> gate: ${step.name}\n`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: ROOT,
    stdio: "inherit",
  });
  return result.status === 0;
}

for (const step of BLOCKING) {
  if (!run(step)) {
    console.error(`\nSTABILIZATION GATE FAILED at: ${step.name}`);
    process.exit(1);
  }
  console.log(`PASS: ${step.name}`);
}

console.log("\nALL BLOCKING STABILIZATION GATES PASSED");
