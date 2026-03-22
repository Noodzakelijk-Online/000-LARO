/**
 * fix-all-imports.js
 * 
 * Automatically fixes all broken import paths in server/ after setup.sh
 * reorganised the flat file structure into proper folders.
 * 
 * Run from project root: node fix-all-imports.js
 */

const fs   = require('fs');
const path = require('path');

// ─── All modules that now live directly in server/ ───────────────────────────
// These were at the project root and got moved to server/ by setup.sh
const SERVER_MODULES = new Set([
  'accessibility', 'adaptiveLLMOrchestrator', 'adminAnalytics', 'agent',
  'agentService', 'ai-legal-inference', 'aiQuestionAnswering', 'aiThreadingService',
  'analytics', 'audit', 'autoCollection', 'autoCollectionService',
  'autonomousEnrichmentScheduler', 'billing', 'bulkCaseImport', 'bulkFileOperations',
  'bulkImport', 'cache', 'caseAggregation', 'caseExport', 'caseManagement',
  'caseStatus', 'clarifications', 'compression', 'context', 'cookies',
  'cron-scheduler', 'dashboardStats', 'dataQuality', 'dataQualityReport',
  'db', 'dateUtils', 'documentAnalysis', 'email', 'email-response-tracker',
  'email-service', 'email-service-oauth2', 'email-templates', 'emailAccounts',
  'emailCategorization', 'emailEvidenceTagging', 'emailMessages', 'emailOAuth',
  'emailOAuthCallbacks', 'emailPreferences', 'emailResponseWebhook', 'emailService',
  'enrichment', 'entityExtractionService', 'error-handler', 'errorHandler',
  'evidence', 'evidenceAggregation', 'evidenceAnalytics', 'evidenceCompilerService',
  'evidenceExport', 'evidenceExportService', 'evidenceFiles', 'evidenceQueryService',
  'evidenceTags', 'evidenceTimeline', 'export', 'gapAnalysis', 'gapDetection',
  'gdpr', 'geocoding', 'globalSearch', 'gmailEnhanced', 'gmailService',
  'googleDrive', 'googleDriveEnhanced', 'googleDriveService',
  'googleDriveServiceEnhanced', 'googleOAuth', 'googleOAuthCallback',
  'googleOAuthService', 'gracePeriod', 'health', 'kvkIntegration',
  'lawyerEnrichmentService', 'lawyerMatchingPaginated', 'lawyerRating',
  'legal-checklists', 'legalAreasValidator', 'legalChecklists',
  'legalDocumentGenerator', 'legalResearch', 'llm', 'llmAnalytics',
  'localFileUpload', 'matching', 'messageTemplates', 'messages',
  'multiProviderLLM', 'notification', 'notificationService', 'notifications',
  'oauth', 'oauth2', 'oauth2Callbacks', 'ocr', 'ocrService', 'oneDriveEnhanced',
  'oneDriveService', 'outlookEnhanced', 'outlookService', 'outreach-automation',
  'outreachAnalytics', 'pagination', 'pdfExtractionService', 'products',
  'queryOptimization', 'rate-limiter', 'rateLimit', 'rechtspraakIntegration',
  'relevanceScoring', 'relevanceScoringService', 'savedSearches', 'schema',
  'schema-email', 'scraper-nova', 'scraper-optimized', 'sdk', 'search',
  'slackEnhanced', 'slackOAuthCallback', 'slackService', 'smtpEmail',
  'storage', 'stripeSubscription', 'stripeWebhooks', 'syncScheduler',
  'telegramEnhanced', 'telegramService', 'timelineGeneration', 'trelloEnhanced',
  'trelloService', 'unifiedInbox', 'unifiedInboxService', 'usageAlerts',
  'usageTracking', 'userNotification', 'userPreferences', 'utils', 'validation',
  'websocket', 'workflow',
]);

// ─── Modules in shared/ ───────────────────────────────────────────────────────
const SHARED_MODULES = new Set([
  'types', 'exclusions', 'const', 'legal-checklists',
]);

// ─── Walk all .ts files in server/ ────────────────────────────────────────────

function getAllTsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Fix imports in a single file ────────────────────────────────────────────

function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Determine depth of file relative to server/
  // server/foo.ts          → depth 1 (relative to server/)
  // server/routers/foo.ts  → depth 2
  const relToServer = path.relative('server', filePath);
  const depth = relToServer.split(path.sep).length - 1; // 0 for files IN server/, 1 for subdirs

  // Replace import strings
  content = content.replace(
    /from\s+(['"])(\.\.\/+)([^'"]+)(['"])/g,
    (match, q1, dots, importPath, q2) => {
      return fixImportPath(match, importPath, depth, q1, q2, filePath);
    }
  );

  // Also fix dynamic imports: await import("../foo")
  content = content.replace(
    /await\s+import\((['"])(\.\.\/+)([^'"]+)(['"]) *\)/g,
    (match, q1, dots, importPath, q2) => {
      const fixed = getFixedPath(importPath, depth, filePath);
      if (fixed) return `await import(${q1}${fixed}${q2})`;
      return match;
    }
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

function fixImportPath(original, importPath, depth, q1, q2, filePath) {
  const fixed = getFixedPath(importPath, depth, filePath);
  if (fixed) return `from ${q1}${fixed}${q2}`;
  return original;
}

function getFixedPath(importPath, depth, filePath) {
  // Strip leading ../  sequences to get the module name
  const clean = importPath.replace(/^(\.\.\/)+/, '');

  // drizzle/schema → ./schema (schema.ts is in server/)
  if (clean === 'drizzle/schema' || importPath.includes('drizzle/schema')) {
    return depth === 0 ? './schema' : '../schema';
  }

  // _core/* paths
  if (clean.startsWith('_core/')) {
    return depth === 0 ? `./${clean}` : `../${clean}`;
  }

  // services/* → flatten (all services are now directly in server/)
  if (clean.startsWith('services/')) {
    const mod = clean.replace('services/', '');
    return depth === 0 ? `./${mod}` : `../${mod}`;
  }

  // shared/* 
  if (clean.startsWith('shared/')) {
    const mod = clean.replace('shared/', '');
    if (SHARED_MODULES.has(mod)) {
      // shared/ is at root level, one up from server/
      return depth === 0 ? `../shared/${mod}` : `../../shared/${mod}`;
    }
    // If the module also exists in server/, prefer that
    if (SERVER_MODULES.has(mod)) {
      return depth === 0 ? `./${mod}` : `../${mod}`;
    }
    return depth === 0 ? `../shared/${mod}` : `../../shared/${mod}`;
  }

  // server/db → ./db
  if (clean.startsWith('server/')) {
    const mod = clean.replace('server/', '');
    return depth === 0 ? `./${mod}` : `../${mod}`;
  }

  // db/evidence → ./evidence
  if (clean === 'db/evidence') {
    return depth === 0 ? './evidence' : '../evidence';
  }

  // Direct module reference — check if it lives in server/
  const moduleName = clean.split('/')[0];
  if (SERVER_MODULES.has(moduleName)) {
    return depth === 0 ? `./${clean}` : `../${clean}`;
  }

  return null; // Don't know — leave as is
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync('server')) {
  console.error('Run this from your project root (where server/ folder is)');
  process.exit(1);
}

const files = getAllTsFiles('server');
let fixed = 0;
let unchanged = 0;

for (const file of files) {
  try {
    if (fixImports(file)) {
      console.log('✅ Fixed:', path.relative(process.cwd(), file));
      fixed++;
    } else {
      unchanged++;
    }
  } catch (err) {
    console.error('❌ Error in', file, ':', err.message);
  }
}

console.log(`\n📊 Results: ${fixed} files fixed, ${unchanged} already correct`);

// ─── Show any remaining broken imports ───────────────────────────────────────

console.log('\n🔍 Checking for remaining broken imports...');
let remaining = 0;
for (const file of getAllTsFiles('server')) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/from\s+['"]\.\.\//) || lines[i].match(/import\(['"]\.\.\//) ) {
      console.log(`  ⚠️  ${path.relative(process.cwd(), file)}:${i + 1} → ${lines[i].trim()}`);
      remaining++;
    }
  }
}

if (remaining === 0) {
  console.log('  ✅ No broken imports remaining!');
  console.log('\n▶️  Run: docker compose up --build');
} else {
  console.log(`\n  ${remaining} imports still need manual review`);
}