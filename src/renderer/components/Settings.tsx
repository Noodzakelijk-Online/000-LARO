import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Bell, Database, Shield, Send, CheckCircle2, XCircle, AlertCircle, Settings as SettingsIcon, Sliders, User } from "lucide-react";
import PersonalizationSettings from "@/components/PersonalizationSettings";
import { NotificationPreferencesTab } from "@/components/NotificationPreferencesTab";
import { useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  
  const [showApiKey, setShowApiKey] = useState(false);
  const { data: apiTokenData } = trpc.auth.getApiToken.useQuery(undefined, { enabled: showApiKey });

  const { data: providerInfo } = (trpc as any).email?.getProviderInfo?.useQuery() ?? { data: null };
  const testEmailMutation = (trpc as any).email?.test?.useMutation() ?? { mutateAsync: async () => ({ success: false, error: "Not implemented" }) };

  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
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
        const message = providerInfo?.provider === 'console' 
          ? 'Test email logged to console (check server logs)' 
          : 'Test email sent successfully! Check your inbox.';
        toast.success(message);
      } else {
        toast.error(`Failed to send test email: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Error sending test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const getProviderStatusBadge = () => {
    if (!providerInfo) return null;
    
    if (providerInfo.configured) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Configured</Badge>;
    } else {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Not Configured</Badge>;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'sendgrid': return 'SendGrid';
      case 'ses': return 'AWS SES';
      case 'smtp': return 'SMTP';
      case 'console': return 'Console (Development)';
      default: return provider;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure system preferences and integrations
          </p>
        </div>

        <Tabs defaultValue="email" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
            <TabsTrigger value="personalization" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Personalization</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="outreach" className="gap-2">
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Outreach</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-2">
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Database</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <SettingsIcon className="w-4 h-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          {/* Personalization Tab */}
          <TabsContent value="personalization" className="space-y-6">
            <PersonalizationSettings />
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Email Service Configuration</CardTitle>
                    <CardDescription className="mt-2">Configure and test your email service provider</CardDescription>
                  </div>
                  {getProviderStatusBadge()}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Provider Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-base">Current Provider</Label>
                    <p className="text-sm font-semibold text-foreground">
                      {providerInfo ? getProviderName(providerInfo.provider) : 'Loading...'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">From Address</Label>
                    <p className="text-sm font-semibold text-foreground">
                      {providerInfo?.from || 'Not configured'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Status</Label>
                    <p className="text-sm font-semibold text-foreground">
                      {providerInfo?.configured ? '✅ Ready to send' : '⚠️ Configuration needed'}
                    </p>
                  </div>
                </div>

                {/* Configuration Warning */}
                {providerInfo && !providerInfo.configured && providerInfo.missingVars.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Missing environment variables: <strong>{providerInfo.missingVars.join(', ')}</strong>
                      <br />
                      Please configure these in your environment settings or .env file.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Console Mode Info */}
                {providerInfo?.provider === 'console' && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Development Mode:</strong> Emails are logged to console, not sent to recipients.
                      <br />
                      Set <code className="bg-muted px-1 py-0.5 rounded">EMAIL_PROVIDER</code> to 'sendgrid', 'ses', or 'smtp' for production.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Test Email */}
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label htmlFor="test-email" className="text-base">Test Email Address</Label>
                    <p className="text-sm text-muted-foreground mt-1 mb-3">
                      Send a test email to verify your configuration
                    </p>
                    <div className="flex gap-2">
                      <Input
                        id="test-email"
                        type="email"
                        placeholder="your-email@example.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTestEmail()}
                        className="max-w-md"
                      />
                      <Button
                        onClick={handleTestEmail}
                        disabled={isTesting || !testEmail}
                      >
                        {isTesting ? (
                          <>Sending...</>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Test
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Documentation Link */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    📖 Need help configuring email service? Check the{" "}
                    <a
                      href="/docs/email-service-setup.md"
                      target="_blank"
                      className="text-primary hover:underline font-medium"
                    >
                      Email Service Setup Guide
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outreach Tab */}
          <TabsContent value="outreach" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Outreach Settings</CardTitle>
                <CardDescription className="mt-2">Configure automated lawyer outreach parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="follow-up-interval" className="text-base">Follow-up Interval (days)</Label>
                    <Input id="follow-up-interval" type="number" defaultValue="5" className="max-w-xs" />
                    <p className="text-sm text-muted-foreground">
                      Days between follow-up emails (Day 0, 5, 10, 15)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-follow-ups" className="text-base">Maximum Follow-ups</Label>
                    <Input id="max-follow-ups" type="number" defaultValue="2" className="max-w-xs" />
                    <p className="text-sm text-muted-foreground">
                      Total follow-ups before marking as "No Response"
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filter-threshold" className="text-base">Permanent Filter Threshold</Label>
                    <Input id="filter-threshold" type="number" defaultValue="3" className="max-w-xs" />
                    <p className="text-sm text-muted-foreground">
                      Contacts with 0% response before filtering (6 months)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batch-limit" className="text-base">Batch Processing Limit</Label>
                    <Input id="batch-limit" type="number" defaultValue="10" className="max-w-xs" />
                    <p className="text-sm text-muted-foreground">
                      Maximum lawyers to contact per case
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button>Save Outreach Settings</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Notification Preferences</CardTitle>
                <CardDescription className="mt-2">Manage how and when you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="notify-match" className="text-base font-medium">Lawyer Match Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when a lawyer shows interest in your case
                      </p>
                    </div>
                    <Switch id="notify-match" defaultChecked />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="notify-email" className="text-base font-medium">Email Activity Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified of email responses and outreach activity
                      </p>
                    </div>
                    <Switch id="notify-email" defaultChecked />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="notify-case" className="text-base font-medium">New Case Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when new cases are added to the system
                      </p>
                    </div>
                    <Switch id="notify-case" defaultChecked />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="notify-scraper" className="text-base font-medium">Scraper Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified of weekly scraper runs and updates
                      </p>
                    </div>
                    <Switch id="notify-scraper" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Tab */}
          <TabsContent value="database" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Database Scraper</CardTitle>
                <CardDescription className="mt-2">Configure lawyer database scraping and updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-base">Scraping Schedule</Label>
                    <p className="text-sm text-muted-foreground">
                      Every Sunday at 2:00 AM
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Last Scrape</Label>
                    <p className="text-sm text-muted-foreground">
                      3 days ago (Success)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Lawyers in Database</Label>
                    <p className="text-sm font-semibold text-foreground">488 lawyers</p>
                  </div>
                </div>
                <div className="pt-4 border-t flex gap-3">
                  <Button>
                    Run Scraper Now
                  </Button>
                  <Button variant="outline">
                    Configure Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">System Configuration</CardTitle>
                <CardDescription className="mt-2">General system settings and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="geo-range" className="text-base">Geographic Range Limit (km)</Label>
                    <Input id="geo-range" type="number" defaultValue="50" className="max-w-xs" />
                    <p className="text-sm text-muted-foreground">
                      Maximum distance for lawyer matching
                    </p>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="auto-match" className="text-base font-medium">Automatic Matching</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically match cases with lawyers
                      </p>
                    </div>
                    <Switch id="auto-match" defaultChecked />
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button>Save System Settings</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Security & Privacy</CardTitle>
                <CardDescription className="mt-2">Manage security settings and data privacy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base">API Keys</Label>
                    <p className="text-sm text-muted-foreground">
                      Manage API keys for external integrations & Local Agents
                    </p>
                    {!apiTokenData ? (
                      <Button variant="outline" size="sm" onClick={() => setShowApiKey(true)}>
                        Generate / View API Key
                      </Button>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <Input readOnly value={apiTokenData.token} className="font-mono text-xs text-muted-foreground h-8" />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(apiTokenData.token);
                            toast.success("API Key copied to clipboard!");
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base">Data Export</Label>
                    <p className="text-sm text-muted-foreground">
                      Export all system data
                    </p>
                    <Button variant="outline" size="sm">
                      Export Data
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base">Activity Logs</Label>
                    <p className="text-sm text-muted-foreground">
                      View system activity logs
                    </p>
                    <Button variant="outline" size="sm">
                      View Logs
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base">Backup & Restore</Label>
                    <p className="text-sm text-muted-foreground">
                      Backup or restore system data
                    </p>
                    <Button variant="outline" size="sm">
                      Manage Backups
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

