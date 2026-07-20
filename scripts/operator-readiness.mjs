#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const productionMode = process.argv.includes('--production');
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

const checks = [
  { name: 'traceability', required: true, cmd: 'node', args: ['scripts/traceability.mjs'] },
  { name: 'no-excuses scan', required: true, cmd: 'node', args: ['scripts/no-excuses-scan.mjs'] },
  { name: 'account safety', required: true, cmd: 'node', args: ['scripts/account-safety-check.mjs'] },
  { name: 'regression baseline', required: true, cmd: 'node', args: ['scripts/regression-baseline.mjs'] },
  {
    name: 'backup/restore drill',
    required: true,
    cmd: process.execPath,
    args: [join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'scripts/recovery-drill.ts'],
  },
  {
    name: 'Flask recovery drill',
    required: true,
    cmd: PYTHON,
    args: ['scripts/flask_recovery_drill.py'],
  },
  {
    name: 'target database readiness',
    required: productionMode,
    cmd: process.execPath,
    args: [join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'scripts/data-readiness.ts'],
  },
  { name: 'production preflight', required: productionMode, cmd: 'node', args: ['scripts/prod-preflight.mjs'] },
];

console.log(`\nOperator readiness (${productionMode ? 'production' : 'repository'} mode)`);
console.log('================================================================');
const failures = [];
for (const check of checks) {
  const result = spawnSync(check.cmd, check.args, {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
    env: productionMode ? { ...process.env, NODE_ENV: 'production' } : process.env,
  });
  const passed = result.status === 0;
  const status = passed ? 'PASS' : check.required ? 'FAIL' : 'WARN';
  console.log(`[${status}] ${check.name}${passed ? '' : ` (exit ${result.status})`}`);
  if (!passed && check.required) {
    failures.push(check.name);
    const detail = [result.stdout, result.stderr]
      .filter((stream) => typeof stream === 'string' && stream.trim())
      .join('\n')
      .trim();
    if (detail) console.error(detail);
  }
}

if (failures.length > 0) {
  console.error(`\nNOT READY: ${failures.join(', ')}`);
  process.exit(1);
}

if (!productionMode) {
  console.log('\nRepository checks passed. Run `npm run readiness:production` with target secrets before an API deployment.');
} else {
  console.log('\nProduction readiness checks passed.');
}
