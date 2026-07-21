import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  FileArchive,
  FolderSearch,
  HardDrive,
  History,
  Mail,
  Send,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import EvidenceConnectionsCard from "@/components/EvidenceConnectionsCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

type SettingsSection = "email" | "sources" | "security";

const NAV_ITEMS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof Mail;
}> = [
  { id: "email", label: "Email", description: "Provider and test send", icon: Mail },
  { id: "sources", label: "Evidence sources", description: "Google and local folders", icon: FolderSearch },
  { id: "security", label: "Security", description: "Account data and activity", icon: Shield },
];

const LARO_FOLDERS_KEY = "laroDefaultLocalScanFolders";

function readDefaultFolders(): string[] {
  try {
    const raw = localStorage.getItem(LARO_FOLDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeDefaultFolders(paths: string[]) {
  localStorage.setItem(LARO_FOLDERS_KEY, JSON.stringify(paths));
  window.dispatchEvent(new CustomEvent("laro:default-folders-changed"));
}

function downloadJsonFile(name: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function providerName(provider: string) {
  if (provider === "sendgrid") return "SendGrid";
  if (provider === "smtp") return "SMTP";
  if (provider === "console") return "Console (development)";
  return provider;
}

export default function Settings() {
  const [section, setSection] = useState<SettingsSection>("email");
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingActivity, setIsDownloadingActivity] = useState(false);
  const [scannerFolders, setScannerFolders] = useState<string[]>(readDefaultFolders);

  const { data: providerInfo } = trpc.email.getProviderInfo.useQuery();
  const testEmailMutation = trpc.email.test.useMutation();
  const exportDataMutation = trpc.gdpr.exportData.useMutation();
  const auditLog = trpc.audit.list.useQuery(
    { limit: 200 },
    { enabled: section === "security" },
  );
  const legacyImports = trpc.legacyImports.listRuns.useQuery(undefined, {
    enabled: section === "security",
  });

  const activeMeta = useMemo(() => NAV_ITEMS.find((item) => item.id === section), [section]);

  const openScanner = useCallback(async () => {
    try {
      if (!window.electronAPI?.selectFolder) {
        toast.message("Folder picker requires LARO Desktop");
        return;
      }
      const result = await window.electronAPI.selectFolder();
      const picked = Array.isArray(result) ? result : result ? [String(result)] : [];
      if (picked.length === 0) return;
      const merged = Array.from(new Set([...readDefaultFolders(), ...picked]));
      writeDefaultFolders(merged);
      setScannerFolders(merged);
      toast.success(picked.length === 1 ? "Folder added" : `${picked.length} folders added`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the folder picker");
    }
  }, []);

  const removeScannerFolder = (path: string) => {
    const next = scannerFolders.filter((folder) => folder !== path);
    writeDefaultFolders(next);
    setScannerFolders(next);
  };

  const handleTestEmail = async () => {
    if (!testEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setIsTesting(true);
    try {
      const result = await testEmailMutation.mutateAsync({
        to: testEmail,
        subject: "LARO Email Service Test",
      });
      result.success ? toast.success(result.message) : toast.error(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test email failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleAccountExport = async () => {
    setIsExporting(true);
    try {
      const archive = await exportDataMutation.mutateAsync();
      downloadJsonFile(`laro-account-archive-${new Date().toISOString().slice(0, 10)}.json`, archive);
      toast.success("Account archive downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleActivityExport = async () => {
    setIsDownloadingActivity(true);
    try {
      const result = await auditLog.refetch();
      if (result.error) throw result.error;
      downloadJsonFile(
        `laro-activity-history-${new Date().toISOString().slice(0, 10)}.json`,
        { generatedAt: new Date().toISOString(), entries: result.data ?? [] },
      );
      toast.success("Activity history downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activity export failed");
    } finally {
      setIsDownloadingActivity(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="mt-2 text-lg text-muted-foreground">Integrations, evidence sources, and account controls</p>
        </div>

        <Card className="border-border/50 bg-card/40">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={section === item.id ? "default" : "outline"}
                    onClick={() => setSection(item.id)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {activeMeta ? (
          <div className="border-b border-border/50 pb-3">
            <p className="text-sm font-medium text-foreground">{activeMeta.label}</p>
            <p className="text-xs text-muted-foreground">{activeMeta.description}</p>
          </div>
        ) : null}

        {section === "email" ? (
          <Card className="border-border/50 bg-card/50 shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Email service</CardTitle>
                  <CardDescription className="mt-2">Current provider configuration and delivery test</CardDescription>
                </div>
                {providerInfo ? (
                  <Badge variant={providerInfo.configured ? "default" : "destructive"}>
                    {providerInfo.configured ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                    {providerInfo.configured ? "Configured" : "Not configured"}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <p className="text-sm font-semibold">{providerInfo ? providerName(providerInfo.provider) : "Loading..."}</p>
                </div>
                <div className="space-y-2">
                  <Label>From address</Label>
                  <p className="text-sm font-semibold">{providerInfo?.from || "Not configured"}</p>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <p className="text-sm font-semibold">{providerInfo?.configured ? "Ready to send" : "Configuration needed"}</p>
                </div>
              </div>

              {providerInfo && !providerInfo.configured && providerInfo.missingVars?.length ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Missing environment variables: {providerInfo.missingVars.join(", ")}</AlertDescription>
                </Alert>
              ) : null}

              {providerInfo?.provider === "console" ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Development provider: messages are logged locally and are not delivered.</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-3 border-t pt-4">
                <Label htmlFor="test-email">Test recipient</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="test-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void handleTestEmail()}
                    className="max-w-md"
                  />
                  <Button onClick={() => void handleTestEmail()} disabled={isTesting || !testEmail}>
                    <Send className="mr-2 h-4 w-4" />
                    {isTesting ? "Sending..." : "Send test"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {section === "sources" ? (
          <div className="space-y-4">
            <EvidenceConnectionsCard />
            <Card className="border-border/50 bg-card/50 shadow-sm">
              <CardHeader>
                <CardTitle>Local computer</CardTitle>
                <CardDescription>Folders included in case keyword pulls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" onClick={() => void openScanner()}>
                  <HardDrive className="mr-2 h-4 w-4" />
                  Add folder
                </Button>
                {scannerFolders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No local folders selected.</p>
                ) : (
                  <div className="space-y-2">
                    {scannerFolders.map((path) => (
                      <div key={path} className="flex items-center gap-2 border-b border-border/40 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm" title={path}>{path}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${path}`}
                          title="Remove folder"
                          onClick={() => removeScannerFolder(path)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {section === "security" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/50 bg-card/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileArchive className="h-5 w-5" />Account archive</CardTitle>
                <CardDescription>Portable JSON export of data owned by your account</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => void handleAccountExport()} disabled={isExporting}>
                  <FileArchive className="mr-2 h-4 w-4" />
                  {isExporting ? "Exporting..." : "Download archive"}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Activity history</CardTitle>
                <CardDescription>Up to 200 recent audit entries for your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {auditLog.isLoading ? "Loading..." : `${auditLog.data?.length ?? 0} entries available`}
                </p>
                <Button variant="outline" onClick={() => void handleActivityExport()} disabled={isDownloadingActivity}>
                  <History className="mr-2 h-4 w-4" />
                  {isDownloadingActivity ? "Preparing..." : "Download activity"}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50 shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" />Legacy workspace imports</CardTitle>
                <CardDescription>Owner-bound Flask migrations retained with source hashes and provenance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {legacyImports.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading migration history...</p>
                ) : legacyImports.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Migration history could not be loaded.</AlertDescription>
                  </Alert>
                ) : (legacyImports.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No Flask workspace has been migrated into this account.</p>
                ) : (
                  <div className="divide-y divide-border/50 border-y border-border/50">
                    {legacyImports.data?.map((run) => (
                      <div key={run.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{run.sourceInstanceId}</p>
                          <p className="text-xs text-muted-foreground">
                            {run.casesImported} cases, {run.recordsImported} archived records, {run.filesCopied} files
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Badge variant={run.missingFiles > 0 ? "destructive" : "outline"}>
                            {run.missingFiles > 0 ? `${run.missingFiles} unavailable files` : "Files verified"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {run.completedAt ? new Date(run.completedAt).toLocaleString() : run.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Archived source rows are included in the Account archive above.</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
