/**
 * fix-everything.js
 * Run once from project root: node fix-everything.js
 * Fixes every known import issue after setup.sh reorganised the project.
 */

const fs   = require('fs');
const path = require('path');

let totalFixed = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFile(p)        { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function writeFile(p, c)    { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); }
function fixFile(p, ...fns) {
  const original = readFile(p);
  if (!original) return;
  let content = original;
  for (const fn of fns) content = fn(content);
  if (content !== original) {
    writeFile(p, content);
    console.log('✅ Fixed:', p);
    totalFixed++;
  }
}

// ─── String replacer helper ───────────────────────────────────────────────────

function replace(...pairs) {
  return (content) => {
    for (let i = 0; i < pairs.length; i += 2) {
      content = content.split(pairs[i]).join(pairs[i + 1]);
    }
    return content;
  };
}

// ─── Walk directory ───────────────────────────────────────────────────────────

function walk(dir, ext = '.ts') {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...walk(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// ─── All server/ files ────────────────────────────────────────────────────────

const serverFiles        = walk('server');
const serverRootFiles    = serverFiles.filter(f => path.dirname(f) === 'server');
const serverRouterFiles  = walk('server/routers');
const serverSubdirFiles  = serverFiles.filter(f => {
  const rel = path.relative('server', f);
  return rel.includes(path.sep); // files in subdirectories
});

// ─── FIX 1: drizzle/schema → ./schema ────────────────────────────────────────

console.log('\n📦 Fixing drizzle/schema imports...');
for (const f of serverFiles) {
  fixFile(f,
    replace(
      `from '../../drizzle/schema'`,  `from './schema'`,
      `from "../../drizzle/schema"`,  `from './schema'`,
      `from '../drizzle/schema'`,     `from './schema'`,
      `from "../drizzle/schema"`,     `from './schema'`,
      `await import("../../drizzle/schema")`, `await import('./schema')`,
      `await import('../drizzle/schema')`,    `await import('./schema')`,
      `await import("../drizzle/schema")`,    `await import('./schema')`,
    )
  );
}

// ─── FIX 2: ../db → ./db ─────────────────────────────────────────────────────

console.log('📦 Fixing db imports...');
for (const f of serverRootFiles) {
  fixFile(f,
    replace(
      `from '../db'`,  `from './db'`,
      `from "../db"`,  `from './db'`,
      `from '../../db'`, `from './db'`,
      `from "../../db"`, `from './db'`,
    )
  );
}
for (const f of serverSubdirFiles) {
  fixFile(f,
    replace(
      `from '../../db'`, `from '../db'`,
      `from "../../db"`, `from '../db'`,
      `from '../db'`,    `from '../db'`,
    )
  );
}

// ─── FIX 3: ../storage → ./storage ───────────────────────────────────────────

console.log('📦 Fixing storage imports...');
for (const f of serverFiles) {
  fixFile(f,
    replace(
      `from '../storage'`, `from './storage'`,
      `from "../storage"`, `from './storage'`,
    )
  );
}

// ─── FIX 4: ../services/* → ./* (services are flat in server/) ───────────────

console.log('📦 Fixing services/ imports...');
for (const f of serverFiles) {
  const content = readFile(f);
  if (!content) continue;
  const fixed = content.replace(
    /from ['"]\.\.\/services\/([^'"]+)['"]/g,
    (_, mod) => `from './${mod}'`
  ).replace(
    /from ['"]\.\.\/\.\.\/services\/([^'"]+)['"]/g,
    (_, mod) => `from '../${mod}'`
  );
  if (fixed !== content) {
    writeFile(f, fixed);
    console.log('✅ Fixed services import:', f);
    totalFixed++;
  }
}

// ─── FIX 5: ../_core/* paths ─────────────────────────────────────────────────

console.log('📦 Fixing _core imports...');
for (const f of serverRootFiles) {
  fixFile(f,
    replace(
      `from '../_core/`,  `from './_core/`,
      `from "../_core/`,  `from './_core/`,
    )
  );
}
// Files in server/routers/ need ../../_core/
for (const f of serverRouterFiles) {
  fixFile(f,
    replace(
      `from '../_core/`,    `from '../../_core/`,
      `from "../_core/`,    `from '../../_core/`,
      `from './_core/`,     `from '../../_core/`,
      `from "./_core/`,     `from '../../_core/`,
    )
  );
}

// ─── FIX 6: shared/ paths ─────────────────────────────────────────────────────

console.log('📦 Fixing shared/ imports...');
for (const f of serverRootFiles) {
  fixFile(f,
    replace(
      `from '../../shared/`,  `from '../shared/`,
      `from "../../shared/`,  `from '../shared/`,
      `from '../shared/`,     `from '../shared/`,
      `from "../shared/`,     `from '../shared/`,
    )
  );
}
for (const f of serverRouterFiles) {
  fixFile(f,
    replace(
      `from '../shared/`,     `from '../../shared/`,
      `from "../shared/`,     `from '../../shared/`,
      `from '../../shared/`,  `from '../../shared/`,
    )
  );
}

// ─── FIX 7: misc broken paths ────────────────────────────────────────────────

console.log('📦 Fixing misc imports...');
for (const f of serverFiles) {
  fixFile(f,
    replace(
      `from '../outreach-automation'`, `from './outreach-automation'`,
      `from "../outreach-automation"`, `from './outreach-automation'`,
      `from '../email-service'`,       `from './email-service'`,
      `from "../email-service"`,       `from './email-service'`,
      `from '../error-handler'`,       `from './error-handler'`,
      `from "../error-handler"`,       `from './error-handler'`,
      `from '../matching'`,            `from './matching'`,
      `from "../matching"`,            `from './matching'`,
      `from '../geocoding'`,           `from './geocoding'`,
      `from "../geocoding"`,           `from './geocoding'`,
      `from '../validation'`,          `from './validation'`,
      `from "../validation"`,          `from './validation'`,
      `from '../sdk'`,                 `from './sdk'`,
      `from "../sdk"`,                 `from './sdk'`,
      `from '../oauth2'`,              `from './oauth2'`,
      `from "../oauth2"`,              `from './oauth2'`,
      `from '../multiProviderLLM'`,    `from './multiProviderLLM'`,
      `from "../multiProviderLLM"`,    `from './multiProviderLLM'`,
      `from '../scraper-nova'`,        `from './scraper-nova'`,
      `from "../scraper-nova"`,        `from './scraper-nova'`,
      `from '../scraper-optimized'`,   `from './scraper-optimized'`,
      `from "../scraper-optimized"`,   `from './scraper-optimized'`,
      `from '../agentService'`,        `from './agentService'`,
      `from "../agentService"`,        `from './agentService'`,
      `from '../emailAccounts'`,       `from './emailAccounts'`,
      `from "../emailAccounts"`,       `from './emailAccounts'`,
      `from '../evidence'`,            `from './evidence'`,
      `from "../evidence"`,            `from './evidence'`,
      `from '../evidenceCompilerService'`, `from './evidenceCompilerService'`,
      `from "../evidenceCompilerService"`, `from './evidenceCompilerService'`,
      `from '../gdpr'`,                `from './gdpr'`,
      `from "../gdpr"`,                `from './gdpr'`,
      `from '../legalAreasValidator'`, `from './legalAreasValidator'`,
      `from "../legalAreasValidator"`, `from './legalAreasValidator'`,
      `from '../trelloService'`,       `from './trelloService'`,
      `from "../trelloService"`,       `from './trelloService'`,
      `from '../email'`,               `from './email'`,
      `from "../email"`,               `from './email'`,
      `from '../bulkCaseImport'`,      `from './bulkCaseImport'`,
      `from "../bulkCaseImport"`,      `from './bulkCaseImport'`,
      `from '../caseAggregation'`,     `from './caseAggregation'`,
      `from "../caseAggregation"`,     `from './caseAggregation'`,
      `from '../db/evidence'`,         `from './evidence'`,
      `from "../db/evidence"`,         `from './evidence'`,
      `from '../server/db'`,           `from './db'`,
      `from "../server/db"`,           `from './db'`,
      `from '../legal-checklists'`,    `from './legal-checklists'`,
      `from "../legal-checklists"`,    `from './legal-checklists'`,
    )
  );
}

// ─── FIX 8: env import in llm.ts and notification.ts ─────────────────────────

console.log('📦 Fixing env imports...');
for (const f of ['server/llm.ts', 'server/notification.ts']) {
  fixFile(f, replace(
    `from "./env"`,  `from './_core/env'`,
    `from './env'`,  `from './_core/env'`,
    `from "../env"`, `from './_core/env'`,
  ));
}

// ─── FIX 9: dynamic imports ───────────────────────────────────────────────────

console.log('📦 Fixing dynamic imports...');
for (const f of serverFiles) {
  const content = readFile(f);
  if (!content) continue;
  const fixed = content
    .replace(/await import\(["']\.\.\/drizzle\/schema["']\)/g, `await import('./schema')`)
    .replace(/await import\(["']\.\.\/\.\.\/drizzle\/schema["']\)/g, `await import('./schema')`)
    .replace(/await import\(["']\.\.\/services\/([^'"]+)["']\)/g, (_, m) => `await import('./${m}')`)
    .replace(/await import\(["']\.\.\/db["']\)/g, `await import('./db')`)
    .replace(/await import\(["']\.\.\/llm["']\)/g, `await import('./llm')`)
    .replace(/await import\(["']\.\.\/\.\.\/drizzle\/schema["']\)/g, `await import('./schema')`);
  if (fixed !== content) {
    writeFile(f, fixed);
    console.log('✅ Fixed dynamic imports:', f);
    totalFixed++;
  }
}

// ─── FIX 10: storage.ts — create if missing ───────────────────────────────────

if (!fs.existsSync('server/storage.ts')) {
  console.log('📦 Creating missing server/storage.ts...');
  writeFile('server/storage.ts', `
/**
 * S3 file storage helpers
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION || 'eu-west-1',
  credentials: {
    accessKeyId:     process.env.AWS_S3_ACCESS_KEY || '',
    secretAccessKey: process.env.AWS_S3_SECRET_KEY || '',
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'laro-evidence';

export async function storagePut(key: string, body: Buffer, contentType = 'application/octet-stream'): Promise<string> {
  if (!process.env.AWS_S3_BUCKET) {
    console.warn('[Storage] S3 not configured — file not uploaded:', key);
    return \`/local/\${key}\`;
  }
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return \`https://\${BUCKET}.s3.amazonaws.com/\${key}\`;
}

export async function storageGet(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: 3600 });
}

export async function storageDelete(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
`.trimStart());
  totalFixed++;
}

// ─── FIX 11: legal-checklists.ts — copy to server/ if missing ────────────────

if (!fs.existsSync('server/legal-checklists.ts') && fs.existsSync('legal-checklists.ts')) {
  fs.copyFileSync('legal-checklists.ts', 'server/legal-checklists.ts');
  console.log('✅ Copied legal-checklists.ts to server/');
  totalFixed++;
}

// ─── REPORT remaining broken imports ─────────────────────────────────────────

console.log('\n🔍 Checking for remaining broken imports...');
let remaining = 0;
for (const f of walk('server')) {
  const content = readFile(f);
  if (!content) continue;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/from\s+['"]\.\.\//) || line.match(/import\(['"]\.\.\//)) {
      console.log(`  ⚠️  ${f}:${i + 1} → ${line.trim()}`);
      remaining++;
    }
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Fixed:     ${totalFixed} files`);
console.log(`   Remaining: ${remaining} broken imports`);

if (remaining === 0) {
  console.log('\n✅ All imports fixed!');
  console.log('▶️  Run: docker compose up --build');
} else {
  console.log('\n⚠️  Some imports still need fixing — paste the list above and I will handle them.');
}