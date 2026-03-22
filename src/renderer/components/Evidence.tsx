import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Plus, Cloud } from "lucide-react";
import { useState } from "react";
import EvidenceCategorization from "@/components/EvidenceCategorization";
import BulkEvidenceUpload from "@/components/BulkEvidenceUpload";
import { EvidenceCollection } from "@/components/EvidenceCollection";
import AutoCollectionSettings from "@/components/AutoCollectionSettings";
import CollectionMonitoringDashboard from "@/components/CollectionMonitoringDashboard";
import EvidenceConnectionsCard from "@/components/EvidenceConnectionsCard";
import EvidenceSummaryDashboard from "@/components/EvidenceSummaryDashboard";
import EvidenceFilters from "@/components/EvidenceFilters";
import EvidenceAnalytics from "@/components/EvidenceAnalytics";
import EvidenceTimeline from "@/components/EvidenceTimeline";
import EvidenceExportUI from "@/components/EvidenceExportUI";
import RelevanceScoringDashboard from "@/components/RelevanceScoringDashboard";
import AutoSyncScheduler from "@/components/AutoSyncScheduler";
import { trpc } from "@/lib/trpc";

export default function Evidence() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("collection");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Fetch user's cases
  const { data: casesData, isLoading: casesLoading } = trpc.cases.list.useQuery();
  const cases = casesData?.cases || [];

  // Mock evidence items for display
  const evidenceItems = [
    {
      id: "1",
      name: "Employment Contract.pdf",
      type: "document" as const,
      source: "manual",
      uploadedAt: new Date("2025-01-15"),
      size: "245 KB",
      relevant: true,
      tags: [],
    },
    {
      id: "2",
      name: "Email Thread - Termination Notice",
      type: "email" as const,
      source: "gmail",
      uploadedAt: new Date("2025-01-20"),
      size: "12 KB",
      relevant: true,
      tags: [],
    },
    {
      id: "3",
      name: "Witness Statement.docx",
      type: "document" as const,
      source: "manual",
      uploadedAt: new Date("2025-01-22"),
      size: "89 KB",
      relevant: true,
      tags: [],
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              Evidence & Documents
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Collect and organize evidence for your legal cases
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              size="lg"
              variant="outline"
              onClick={() => setBulkUploadOpen(true)}
            >
              <Upload className="w-5 h-5 mr-2" />
              Bulk Upload
            </Button>
            <Button 
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Plus className="w-5 h-5 mr-2" />
              Upload Files
            </Button>
          </div>
        </div>

        {/* Case Selection */}
        {cases.length > 0 && (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Select a Case
              </CardTitle>
              <CardDescription>
                Choose which case to collect evidence for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cases.map((caseItem: any) => (
                  <Card
                    key={caseItem.id}
                    className={`cursor-pointer transition-all ${
                      selectedCaseId === caseItem.id
                        ? "border-orange-500 bg-orange-50/50"
                        : "hover:border-orange-300"
                    }`}
                    onClick={() => setSelectedCaseId(caseItem.id)}
                  >
                    <CardContent className="p-4">
                      <p className="font-semibold">{caseItem.clientName || caseItem.title || "Unnamed Case"}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {caseItem.caseSummary || caseItem.description || "No description"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-3">
                        Type: <span className="capitalize font-medium">{caseItem.caseType || "Unknown"}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Status: <span className="capitalize font-medium">{caseItem.status || "Unknown"}</span>
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="dashboard" className="gap-2">
              <Cloud className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="collection" className="gap-2">
              <Cloud className="h-4 w-4" />
              Collect
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2">
              <FileText className="h-4 w-4" />
              Items
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <FileText className="h-4 w-4" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Upload className="h-4 w-4" />
              Export
            </TabsTrigger>
            <TabsTrigger value="scoring" className="gap-2">
              <FileText className="h-4 w-4" />
              Scoring
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <Cloud className="h-4 w-4" />
              Sync
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <EvidenceSummaryDashboard caseId={selectedCaseId || undefined} />
          </TabsContent>

          {/* Collection Tab - Shows EvidenceCollection */}
          <TabsContent value="collection" className="space-y-4">
            {/* Evidence Connections Card */}
            <EvidenceConnectionsCard />
            
            {selectedCaseId ? (
              <EvidenceCollection caseId={selectedCaseId} />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Cloud className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-semibold">Select a case first</p>
                  <p className="text-muted-foreground mt-2">
                    Choose a case above to start collecting evidence from multiple sources
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Evidence Items Tab */}
          <TabsContent value="items" className="space-y-4">
            <EvidenceCategorization
              items={evidenceItems}
              onView={(id) => console.log("View:", id)}
              onDownload={(id) => console.log("Download:", id)}
            />
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-4">
            {selectedCaseId ? (
              <CollectionMonitoringDashboard caseId={selectedCaseId} />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">
                    Select a case to view monitoring dashboard
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            {selectedCaseId ? (
              <EvidenceExportUI caseId={selectedCaseId} />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-semibold">Select a case first</p>
                  <p className="text-muted-foreground mt-2">
                    Choose a case above to export evidence
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Relevance Scoring Tab */}
          <TabsContent value="scoring" className="space-y-4">
            {selectedCaseId ? (
              <RelevanceScoringDashboard caseId={selectedCaseId} />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-semibold">Select a case first</p>
                  <p className="text-muted-foreground mt-2">
                    Choose a case above to view relevance scoring
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Auto-Sync Scheduler Tab */}
          <TabsContent value="sync" className="space-y-4">
            {selectedCaseId ? (
              <AutoSyncScheduler caseId={selectedCaseId} />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Cloud className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-semibold">Select a case first</p>
                  <p className="text-muted-foreground mt-2">
                    Choose a case above to configure auto-sync settings
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* File Upload Dialog - Handled by BulkEvidenceUpload below */}

        {/* Bulk Evidence Upload */}
        <BulkEvidenceUpload
          caseId={selectedCaseId || "default-case-id"}
          open={bulkUploadOpen}
          onClose={() => setBulkUploadOpen(false)}
          onComplete={() => {
            setBulkUploadOpen(false);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
