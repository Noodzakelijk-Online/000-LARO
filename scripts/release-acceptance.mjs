#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATE_NAMES = ['publicBrand', 'liveProviders'];

function argumentValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function validApproval(gate) {
  return gate?.status === 'approved'
    && typeof gate.approvedBy === 'string'
    && gate.approvedBy.trim().length > 0
    && typeof gate.approvedAt === 'string'
    && Number.isFinite(Date.parse(gate.approvedAt))
    && Array.isArray(gate.evidence)
    && gate.evidence.length > 0
    && gate.evidence.every((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

export function validateReleaseAcceptance({ record, packageVersion, tag, requireApproved = false }) {
  const errors = [];
  const pending = [];

  if (record?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (record?.version !== packageVersion) {
    errors.push(`record version ${record?.version ?? '(missing)'} does not match package version ${packageVersion}`);
  }
  if (tag && tag !== `v${packageVersion}`) {
    errors.push(`tag ${tag} does not match package version v${packageVersion}`);
  }

  for (const gateName of GATE_NAMES) {
    const gate = record?.gates?.[gateName];
    if (!gate || !['pending', 'approved'].includes(gate.status)) {
      errors.push(`${gateName}.status must be pending or approved`);
      continue;
    }
    if (gate.status !== 'approved') {
      pending.push(gateName);
    } else if (!validApproval(gate)) {
      errors.push(`${gateName} approval requires approvedBy, approvedAt, and at least one evidence reference`);
    }
  }

  const providerGate = record?.gates?.liveProviders;
  if (providerGate?.status === 'approved'
      && (!Array.isArray(providerGate.providerScope)
        || providerGate.providerScope.length === 0
        || providerGate.providerScope.some((provider) => typeof provider !== 'string' || provider.trim().length === 0))) {
    errors.push('liveProviders approval requires a non-empty providerScope');
  }
  if (requireApproved && pending.length > 0) {
    errors.push(`release acceptance pending: ${pending.join(', ')}`);
  }

  return { errors, pending };
}

export function runReleaseAcceptance(args = process.argv.slice(2)) {
  const packageVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const requestedFile = argumentValue(args, '--file') || join(ROOT, 'release-acceptance.json');
  const recordPath = isAbsolute(requestedFile) ? requestedFile : resolve(process.cwd(), requestedFile);
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  const requireApproved = args.includes('--require-approved');
  const tag = argumentValue(args, '--tag');
  const result = validateReleaseAcceptance({ record, packageVersion, tag, requireApproved });

  console.log(`Release acceptance for v${packageVersion}`);
  for (const gateName of GATE_NAMES) {
    console.log(`- ${gateName}: ${record?.gates?.[gateName]?.status ?? 'missing'}`);
  }
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    return 1;
  }
  if (result.pending.length > 0) {
    console.log(`Pending external gates: ${result.pending.join(', ')}`);
  } else {
    console.log('All recorded external acceptance gates are approved.');
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runReleaseAcceptance();
}
