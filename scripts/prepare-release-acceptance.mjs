#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDER_REQUIREMENTS } from './release-acceptance.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL_RECORD = join(ROOT, 'release-acceptance.json');
const DEFAULT_OUTPUT = join(ROOT, 'release-acceptance.draft.json');
const BRAND_ASSETS = ['build/icon.png', 'public/laro-logo.png'];

function argumentValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function usage() {
  return [
    'Prepare a non-approved release-acceptance draft without reading credentials.',
    '',
    'Usage:',
    '  npm run release:prepare -- --providers google,outboundEmail [--output <path>] [--force]',
    '',
    `Supported providers: ${Object.keys(PROVIDER_REQUIREMENTS).join(', ')}`,
  ].join('\n');
}

export function prepareReleaseAcceptance(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }

  const requestedProviders = argumentValue(args, '--providers');
  if (!requestedProviders) throw new Error('--providers is required');
  const providerScope = requestedProviders
    .split(',')
    .map((provider) => provider.trim())
    .filter(Boolean);
  if (providerScope.length === 0) throw new Error('--providers must contain at least one provider');
  if (new Set(providerScope).size !== providerScope.length) {
    throw new Error('--providers must not contain duplicates');
  }
  const unsupported = providerScope.filter((provider) => !(provider in PROVIDER_REQUIREMENTS));
  if (unsupported.length > 0) throw new Error(`Unsupported providers: ${unsupported.join(', ')}`);

  const requestedOutput = argumentValue(args, '--output');
  const output = requestedOutput
    ? (isAbsolute(requestedOutput) ? requestedOutput : resolve(process.cwd(), requestedOutput))
    : DEFAULT_OUTPUT;
  if (resolve(output) === resolve(CANONICAL_RECORD)) {
    throw new Error('Refusing to overwrite release-acceptance.json; prepare and review a draft first');
  }
  if (existsSync(output) && !args.includes('--force')) {
    throw new Error(`Output already exists: ${output}. Pass --force to replace this draft.`);
  }

  const packageVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const preparedAt = new Date().toISOString();
  const assets = BRAND_ASSETS.map((relativePath) => {
    const absolutePath = join(ROOT, relativePath);
    const metadata = statSync(absolutePath);
    return { path: relativePath, bytes: metadata.size, sha256: sha256(absolutePath) };
  });
  const providerChecks = Object.fromEntries(providerScope.map((provider) => [provider, {
    status: 'pending',
    testedAt: null,
    evidence: [],
    checks: [],
    requiredChecks: [...PROVIDER_REQUIREMENTS[provider]],
  }]));
  const record = {
    schemaVersion: 1,
    version: packageVersion,
    preparedAt,
    gates: {
      publicBrand: {
        status: 'pending',
        approvedBy: null,
        approvedAt: null,
        evidence: [],
        assets,
      },
      liveProviders: {
        status: 'pending',
        approvedBy: null,
        approvedAt: null,
        evidence: [],
        providerScope,
        providerChecks,
      },
    },
  };

  writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: 'utf8',
    flag: args.includes('--force') ? 'w' : 'wx',
  });
  console.log(`Prepared release acceptance draft: ${output}`);
  console.log('No gate was approved and no provider credential was read or stored.');
  for (const provider of providerScope) {
    console.log(`- ${provider}: ${PROVIDER_REQUIREMENTS[provider].join(', ')}`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = prepareReleaseAcceptance();
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
