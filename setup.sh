#!/bin/bash
# ─────────────────────────────────────────────────────────────
# LARO V8 — folder reorganisation script
# Run from inside your "000 - Laro V8" project root:
#   bash setup.sh
# ─────────────────────────────────────────────────────────────
set -e
ROOT="$(pwd)"

echo "📁 Creating folder structure..."
mkdir -p \
  src/renderer/_core/hooks \
  src/renderer/components/ui \
  src/renderer/components/billing \
  src/renderer/contexts \
  src/renderer/hooks \
  src/renderer/lib \
  src/renderer/pages \
  src/shared \
  electron \
  server/routers \
  assets

# ─── Delete the old Vue vite config that breaks the build ─────
echo "🗑  Removing old vite.config.js (Vue)..."
rm -f vite.config.js

# ─── ELECTRON main process ────────────────────────────────────
echo "⚡ Moving Electron files..."
mv -f index.ts        electron/index.ts        2>/dev/null || true
mv -f preload.ts      electron/preload.ts      2>/dev/null || true
mv -f autoUpdater.ts  electron/autoUpdater.ts  2>/dev/null || true
mv -f database.ts     electron/database.ts     2>/dev/null || true
mv -f scanner.ts      electron/scanner.ts      2>/dev/null || true
mv -f uploader.ts     electron/uploader.ts     2>/dev/null || true
mv -f fileScanner.ts  electron/fileScanner.ts  2>/dev/null || true
mv -f agentService.ts electron/agentService.ts 2>/dev/null || true

# ─── SHARED types (electron + renderer both import these) ──────
echo "🔗 Moving shared files..."
mv -f types.ts      src/shared/types.ts      2>/dev/null || true
mv -f exclusions.ts src/shared/exclusions.ts 2>/dev/null || true

# ─── Create src/shared/const.ts (was missing entirely) ────────
echo "📝 Creating src/shared/const.ts..."
cat > src/shared/const.ts << 'CONST'
export const COOKIE_NAME = "laro_session";
export const UNAUTHED_ERR_MSG = "UNAUTHORIZED";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const getLoginUrl = () => "/login";
CONST

# ─── Create src/renderer/const.ts (for @/const imports) ──────
cat > src/renderer/const.ts << 'CONST'
export { COOKIE_NAME, UNAUTHED_ERR_MSG, ONE_YEAR_MS, getLoginUrl } from "../../shared/const";
CONST

# ─── RENDERER entry points ────────────────────────────────────
echo "🎨 Moving renderer entry files..."
mv -f main.tsx      src/renderer/main.tsx      2>/dev/null || true
mv -f App.tsx       src/renderer/App.tsx       2>/dev/null || true
mv -f index.css     src/renderer/index.css     2>/dev/null || true
mv -f vite-env.d.ts src/renderer/vite-env.d.ts 2>/dev/null || true

# ─── RENDERER lib ─────────────────────────────────────────────
echo "📚 Moving lib files..."
mv -f utils.ts  src/renderer/lib/utils.ts  2>/dev/null || true
mv -f trpc.ts   src/renderer/lib/trpc.ts   2>/dev/null || true

# ─── RENDERER hooks & contexts ────────────────────────────────
echo "🪝 Moving hooks..."
mv -f useAuth.ts              src/renderer/_core/hooks/useAuth.ts              2>/dev/null || true
mv -f useWebSocket.ts         src/renderer/_core/hooks/useWebSocket.ts         2>/dev/null || true
mv -f useKeyboardShortcuts.ts src/renderer/hooks/useKeyboardShortcuts.ts       2>/dev/null || true
mv -f WebSocketContext.tsx    src/renderer/contexts/WebSocketContext.tsx        2>/dev/null || true

# ─── RENDERER pages ───────────────────────────────────────────
echo "📄 Moving pages..."
mv -f AuthPage.tsx    src/renderer/pages/AuthPage.tsx    2>/dev/null || true
mv -f HomePage.tsx    src/renderer/pages/HomePage.tsx    2>/dev/null || true
mv -f ScanPage.tsx    src/renderer/pages/ScanPage.tsx    2>/dev/null || true
mv -f SettingsPage.tsx src/renderer/pages/SettingsPage.tsx 2>/dev/null || true

# sidebar goes to components/ui
mv -f sidebar.tsx src/renderer/components/ui/sidebar.tsx 2>/dev/null || true

# ─── RENDERER components — billing ────────────────────────────
mv -f UsageQuotaWidget.tsx src/renderer/components/billing/UsageQuotaWidget.tsx 2>/dev/null || true

# ─── RENDERER components — everything else ────────────────────
echo "🧩 Moving components..."
for f in \
  ActivityFeedWidget Admin AdminAnalytics AdvancedLawyerSearch \
  AgentDownload AgentScanHistory AgentStatus Analytics AnnotationCanvas \
  AutoCollectionSettings AutoSyncScheduler AutomatedDocumentAnalysis \
  BatchOperations BillingDashboard BulkCaseActions BulkCaseImport \
  BulkEvidenceUpload BulkFileOperations CaseCreationWizard CaseDetailsDialog \
  CaseSearchFilter CaseStatusTracker CaseStatusWorkflow CaseTimeline Cases \
  ChatWidget CollectionMonitoringDashboard CommunicationHub CommunicationLog \
  ConnectionStatus CriticalGapsAlert DashboardLayout DataEnrichment \
  DataSourceConnector DeadlineManager DocumentAnalysisResults DocumentFolderView \
  EmailAutomation EmailConnectionDialog EmailPreferences EmailSettings \
  EmailSyncDialog EmailTemplateEditor EnhancedCaseDetailsDialog EnhancedEvidenceUpload \
  EnhancedStatsCards ErrorBoundarySection Evidence EvidenceAnalytics \
  EvidenceCategorization EvidenceCollection EvidenceConnectionsCard EvidenceExportUI \
  EvidenceFilters EvidenceGapAnalysisDashboard EvidenceGapIndicator EvidenceSearch \
  EvidenceSummaryDashboard EvidenceTimeline EvidenceTimelineView EvidenceValidation \
  FileComparisonView FilePreview FilePreviewModal FileUploadDialog GlobalLoading \
  GlobalSearch GmailFilteredSync GmailSimple GoogleDriveFilePicker \
  GoogleDriveIntegration GoogleDriveSimple Help Home KeyboardShortcutsDialog \
  LawyerComparison LawyerProfile LawyerProfileCard Lawyers LegalAreasSelect \
  LegalDocumentGenerator LocalFileUpload Messages MobileOptimizations \
  MultiDisciplineOutreachChart NewCaseDialog NotificationCenter \
  NotificationPreferencesTab OcrExtractor OnboardingWizard OneDriveSimple \
  OutreachAnalytics OutreachAnalyticsView OutreachProgressBar PageErrorBoundary \
  PersonalizationSettings Pricing Privacy ProgressChart ProgressTrackingDashboard \
  PublicRecordsPanel QuickActionsMenu RelevanceScoringDashboard Reports \
  Settings SkeletonLoaders SkipNavigation SlackSimple SmartCaseCreationWizard \
  SmartSearchFilters TimelineView TrelloSimple UnifiedInbox UpgradeDialog \
  UsageAlertBanner
do
  [ -f "${f}.tsx" ] && mv -f "${f}.tsx" "src/renderer/components/${f}.tsx"
done

# ─── SERVER files (tRPC routers, services, DB) ────────────────
echo "🖥  Moving server files..."
for f in \
  routers schema schema-email db \
  analytics adminAnalytics agent autoCollection autoCollectionService \
  autonomousEnrichmentScheduler billing bulkCaseImport bulkFileOperations \
  bulkImport cache caseAggregation caseExport caseManagement caseStatus \
  clarifications compression context cookies cron-scheduler dashboardStats \
  dataQuality dataQualityReport dateUtils documentAnalysis \
  email email-response-tracker email-service email-service-oauth2 email-templates \
  emailAccounts emailCategorization emailEvidenceTagging emailMessages \
  emailOAuth emailOAuthCallbacks emailPreferences emailResponseWebhook emailService \
  enrichment entityExtractionService error-handler errorHandler \
  evidenceAggregation evidenceAnalytics evidenceCompilerService evidenceExport \
  evidenceExportService evidenceFiles evidenceQueryService evidenceTimeline \
  evidenceTags gapAnalysis gapDetection gdpr geocoding globalSearch \
  gmailEnhanced gmailService googleDrive googleDriveEnhanced googleDriveService \
  googleDriveServiceEnhanced googleOAuth googleOAuthCallback googleOAuthService \
  gracePeriod health kvkIntegration lawyerEnrichmentService \
  lawyerMatchingPaginated lawyerRating legal-checklists legalAreasValidator \
  legalChecklists legalDocumentGenerator legalResearch llm llmAnalytics \
  localFileUpload matching messageTemplates messages multiProviderLLM \
  notification notificationService notifications oauth oauth2 oauth2Callbacks \
  ocr ocrService oneDriveEnhanced oneDriveService outlookEnhanced outlookService \
  outreach-automation outreachAnalytics pagination pdfExtractionService products \
  queryOptimization rate-limiter rateLimit rechtspraakIntegration \
  relevanceScoring relevanceScoringService savedSearches scraper-nova \
  scraper-optimized search seed-data slackEnhanced slackOAuthCallback slackService \
  smtpEmail stripeSubscription stripeWebhooks syncScheduler telegramEnhanced \
  telegramService timelineGeneration trelloEnhanced trelloService \
  unifiedInbox unifiedInboxService usageAlerts usageTracking userNotification \
  userPreferences validation websocket workflow \
  adaptiveLLMOrchestrator ai-legal-inference aiQuestionAnswering aiThreadingService \
  audit accessibility
do
  [ -f "${f}.ts" ] && mv -f "${f}.ts" "server/${f}.ts"
done

# ─── SERVER routers (already imported as a group in routers.ts) 
mv -f server/routers.ts server/routers/index.ts 2>/dev/null || true

# ─── Clean up leftover scripts/debug/test files ───────────────
echo "🧹 Moving dev/debug scripts..."
mkdir -p scripts
for f in \
  run-scraper run-optimized-scraper scrape-rechtspraak \
  debug-page-247 debug-scraper debug-tools analyze-dom \
  check-pagination test-extraction test-matching test-matching-accuracy \
  validate-matching verify-matching seed-data
do
  [ -f "${f}.ts" ] && mv -f "${f}.ts" "scripts/${f}.ts"
done

# ─── Final summary ────────────────────────────────────────────
echo ""
echo "✅ Done! Structure:"
echo "   electron/      $(ls electron/*.ts 2>/dev/null | wc -l) files"
echo "   src/shared/    $(ls src/shared/*.ts 2>/dev/null | wc -l) files"
echo "   src/renderer/  $(find src/renderer -name '*.tsx' -o -name '*.ts' 2>/dev/null | wc -l) files"
echo "   server/        $(ls server/*.ts 2>/dev/null | wc -l) files"
echo ""
echo "Next step → install shadcn/ui components:"
echo "   npx shadcn@latest init"
echo "   npx shadcn@latest add button card tabs dialog badge input select scroll-area progress tooltip separator avatar checkbox label switch slider textarea alert"