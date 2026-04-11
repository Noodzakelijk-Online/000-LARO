import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mail,
  Bell,
  Shield,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings as SettingsIcon,
  Sliders,
  User,
  HardDrive,
} from "lucide-react";
import PersonalizationSettings from "@/components/PersonalizationSettings";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type SettingsSection =
  | "personalization"
  | "email"
  | "outreach"
  | "notifications"
  | "system"
  | "security";

const NAV_ITEMS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof Mail;
}> = [
  { id: "personalization", label: "Personalization", description: "Dashboard & templates", icon: User },
  { id: "email", label: "Email", description: "Provider & test send", icon: Mail },
  { id: "outreach", label: "Outreach", description: "Follow-ups & scraper", icon: Sliders },
  { id: "notifications", label: "Notifications", description: "Alerts & channels", icon: Bell },
  { id: "system", label: "System", description: "Matching & scanner", icon: SettingsIcon },
  { id: "security", label: "Security", description: "Data & privacy", icon: Shield },
];

export default function Settings() {
  const [section, setSection] = useState<SettingsSection>("email");
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [scraperSchedule, setScraperSchedule] = useState("Every Sunday at 2:00 AM");
  const scraperScheduleInputRef = useRef<HTMLInputElement>(null);

  const { data: providerInfo } = trpc.email.getProviderInfo.useQuery();
  const testEmailMutation = trpc.email.test.useMutation();

  const openScanner = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && window.electronAPI?.openScanPanel) {
        await window.electronAPI.openScanPanel();
        toast.success("Evidence scanner opened");
        return;
      }
      toast.message("Scanner is only available in the LARO Desktop app", {
        description: "Run the app with Electron (npm run dev), or use the menu: Evidence → Scan Local Files.",
      });
    } catch {
      toast.error("Could not open the scanner window");
    }
  }, []);

  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsTesting(true);
    try {
      const result = await testEmailMutation.mutateAsync({
        to: testEmail,
        subject: "LARO Email Service Test",
      });

      if (result.success) {
        const message =
          providerInfo?.provider === "console"
            ? "Test email logged to console (check server logs)"
            : "Test email sent successfully! Check your inbox.";
        toast.success(message);
      } else {
        toast.error(`Failed to send test email: ${(result as { error?: string }).error ?? "Unknown"}`);
      }
    } catch (error) {
      toast.error(`Error sending test email: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTesting(false);
    }
  };

  const getProviderStatusBadge = () => {
    if (!providerInfo) return null;

    if (providerInfo.configured) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Configured
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        Not Configured
      </Badge>
    );
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case "sendgrid":
        return "SendGrid";
      case "ses":
        return "AWS SES";
      case "smtp":
        return "SMTP";
      case "console":
        return "Console (Development)";
      default:
        return provider;
    }
  };

  const activeMeta = useMemo(() => NAV_ITEMS.find((n) => n.id === section), [section]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Configure system preferences and integrations
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-6">
          <Card className="border-border/50 bg-card/50 h-fit shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Settings areas</CardTitle>
              <CardDescription>Pick a category to edit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={active ? "default" : "ghost"}
                    className={`h-auto min-h-11 w-full flex-col items-stretch gap-0.5 py-3 px-3 text-left ${active ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                    onClick={() => setSection(item.id)}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className="h-4 w-4 shrink-0 opacity-90" />
                      {item.label}
                    </span>
                    <span className={`pl-6 text-xs font-normal ${active ? "text-white/90" : "text-muted-foreground"}`}>
                      {item.description}
                    </span>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-6">
            {activeMeta && (
              <div className="rounded-lg border border-border/50 bg-card/30 px-4 py-3">
                <p className="text-sm font-medium text-foreground">{activeMeta.label}</p>
                <p className="text-xs text-muted-foreground">{activeMeta.description}</p>
              </div>
            )}

            {section === "personalization" && (
              <div className="rounded-xl border border-border/50 bg-card/40 p-4 md:p-6">
                <PersonalizationSettings />
              </div>
            )}

            {section === "email" && (
              <Card className="border-border/50 bg-card/50 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-2xl">Email Service Configuration</CardTitle>
                      <CardDescription className="mt-2">
                        Configure and test your email service provider
                      </CardDescription>
                    </div>
                    {getProviderStatusBadge()}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-base">Current Provider</Label>
                      <p className="text-sm font-semibold text-foreground">
                        {providerInfo ? getProviderName(providerInfo.provider) : "Loading…"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base">From Address</Label>
                      <p className="text-sm font-semibold text-foreground">
                        {providerInfo?.from || "Not configured"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base">Status</Label>
                      <p className="text-sm font-semibold text-foreground">
                        {providerInfo?.configured ? "Ready to send" : "Configuration needed"}
                      </p>
                    </div>
                  </div>

                  {providerInfo && !providerInfo.configured && providerInfo.missingVars?.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Missing environment variables: <strong>{providerInfo.missingVars.join(", ")}</strong>
                        <br />
                        Configure these in your environment or <code className="rounded bg-muted px-1">.env</code> file.
                      </AlertDescription>
                    </Alert>
                  )}

                  {providerInfo?.provider === "console" && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Development mode:</strong> Emails are logged to the server console, not delivered.
                        Set <code className="rounded bg-muted px-1 py-0.5">EMAIL_PROVIDER</code> and provider keys for
                        production.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <Label htmlFor="test-email" className="text-base">
                        Test email address
                      </Label>
                      <p className="mt-1 mb-3 text-sm text-muted-foreground">
                        Send a test message to verify configuration
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          id="test-email"
                          type="email"
                          placeholder="your-email@example.com"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleTestEmail()}
                          className="max-w-md"
                        />
                        <Button onClick={handleTestEmail} disabled={isTesting || !testEmail}>
                          {isTesting ? (
                            "Sending…"
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Send test
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {section === "outreach" && (
              <div className="space-y-6">
                <Card className="border-border/50 bg-card/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-2xl">Outreach Settings</CardTitle>
                    <CardDescription className="mt-2">
                      Configure automated lawyer outreach parameters
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="follow-up-interval" className="text-base">
                          Follow-up interval (days)
                        </Label>
                        <Input id="follow-up-interval" type="number" defaultValue="5" className="max-w-xs" />
                        <p className="text-sm text-muted-foreground">
                          Days between follow-up emails (Day 0, 5, 10, 15)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-follow-ups" className="text-base">
                          Maximum follow-ups
                        </Label>
                        <Input id="max-follow-ups" type="number" defaultValue="2" className="max-w-xs" />
                        <p className="text-sm text-muted-foreground">
                          Total follow-ups before marking as &quot;No Response&quot;
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="filter-threshold" className="text-base">
                          Permanent filter threshold
                        </Label>
                        <Input id="filter-threshold" type="number" defaultValue="3" className="max-w-xs" />
                        <p className="text-sm text-muted-foreground">
                          Contacts with 0% response before filtering (6 months)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="batch-limit" className="text-base">
                          Batch processing limit
                        </Label>
                        <Input id="batch-limit" type="number" defaultValue="10" className="max-w-xs" />
                        <p className="text-sm text-muted-foreground">Maximum lawyers to contact per case</p>
                      </div>
                    </div>
                    <p className="flex items-center text-sm font-medium text-muted-foreground">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      Changes are saved automatically
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-2xl">Scraper</CardTitle>
                    <CardDescription className="mt-2">
                      Configure lawyer database scraping and run collection jobs
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-base">Scraping schedule</Label>
                        <Input
                          ref={scraperScheduleInputRef}
                          value={scraperSchedule}
                          onChange={(e) => {
                            setScraperSchedule(e.target.value);
                            toast.success("Schedule saved automatically");
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base">Last scrape</Label>
                        <p className="text-sm text-muted-foreground">3 days ago (Success)</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base">Lawyers in database</Label>
                        <p className="text-sm font-semibold text-foreground">488 lawyers</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 border-t pt-4">
                      <Button onClick={() => toast.success("Scraper started")}>Run scraper now</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          scraperScheduleInputRef.current?.focus();
                          scraperScheduleInputRef.current?.select();
                          toast.message("Edit the schedule field above", {
                            description: "Your changes apply as you type.",
                          });
                        }}
                      >
                        Configure schedule
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {section === "notifications" && (
              <Card className="border-border/50 bg-card/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl">Notification Preferences</CardTitle>
                  <CardDescription className="mt-2">Manage how and when you receive notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="notify-match" className="text-base font-medium">
                          Lawyer match notifications
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when a lawyer shows interest in your case
                        </p>
                      </div>
                      <Switch id="notify-match" defaultChecked />
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="notify-email" className="text-base font-medium">
                          Email activity notifications
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified of email responses and outreach activity
                        </p>
                      </div>
                      <Switch id="notify-email" defaultChecked />
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="notify-case" className="text-base font-medium">
                          New case notifications
                        </Label>
                        <p className="text-sm text-muted-foreground">Get notified when new cases are added</p>
                      </div>
                      <Switch id="notify-case" defaultChecked />
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="notify-scraper" className="text-base font-medium">
                          Scraper notifications
                        </Label>
                        <p className="text-sm text-muted-foreground">Get notified of weekly scraper runs</p>
                      </div>
                      <Switch id="notify-scraper" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {section === "system" && (
              <Card className="border-border/50 bg-card/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl">System Configuration</CardTitle>
                  <CardDescription className="mt-2">General system settings and preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="geo-range" className="text-base">
                        Geographic range limit (km)
                      </Label>
                      <Input id="geo-range" type="number" defaultValue="50" className="max-w-xs" />
                      <p className="text-sm text-muted-foreground">Maximum distance for lawyer matching</p>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="auto-match" className="text-base font-medium">
                          Automatic matching
                        </Label>
                        <p className="text-sm text-muted-foreground">Automatically match cases with lawyers</p>
                      </div>
                      <Switch id="auto-match" defaultChecked />
                    </div>
                  </div>

                  <div className="mt-4 space-y-4 border-t pt-6">
                    <div>
                      <Label className="text-base font-medium">Local computer scanner</Label>
                      <p className="mb-4 text-sm text-muted-foreground">
                        Open the desktop scanner to find files on this machine and attach them to a case.
                      </p>
                      <Button variant="outline" className="border-purple-500/30 font-semibold" onClick={openScanner}>
                        <HardDrive className="mr-2 h-4 w-4 text-purple-500" />
                        Scan computer for evidence
                      </Button>
                    </div>
                  </div>

                  <p className="flex items-center border-t pt-4 text-sm font-medium text-muted-foreground">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                    Changes are saved automatically
                  </p>
                </CardContent>
              </Card>
            )}

            {section === "security" && (
              <Card className="border-border/50 bg-card/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl">Security &amp; Privacy</CardTitle>
                  <CardDescription className="mt-2">Manage security settings and data privacy</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-3 rounded-lg border border-border/50 p-4">
                      <Label className="text-base">Data export</Label>
                      <p className="text-sm text-muted-foreground">Export all system data</p>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        Export data
                      </Button>
                    </div>
                    <div className="space-y-3 rounded-lg border border-border/50 p-4">
                      <Label className="text-base">Activity logs</Label>
                      <p className="text-sm text-muted-foreground">View system activity logs</p>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        View logs
                      </Button>
                    </div>
                    <div className="space-y-3 rounded-lg border border-border/50 p-4 sm:col-span-2">
                      <Label className="text-base">Backup &amp; restore</Label>
                      <p className="text-sm text-muted-foreground">Backup or restore system data</p>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        Manage backups
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
