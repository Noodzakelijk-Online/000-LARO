import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Upload, Plus, Cloud, BarChart2,
  Clock, Filter, Scan, FolderOpen, AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import EvidenceCategorization from "@/components/EvidenceCategorization";
import BulkEvidenceUpload from "@/components/BulkEvidenceUpload";
import { EvidenceCollection } from "@/components/EvidenceCollection";
import AutoCollectionSettings from "@/components/AutoCollectionSettings";
import CollectionMonitoringDashboard from "@/components/CollectionMonitoringDashboard";
import EvidenceConnectionsCard from "@/components/EvidenceConnectionsCard";
import EvidenceSummaryDashboard from "@/components/EvidenceSummaryDashboard";
import EvidenceAnalytics from "@/components/EvidenceAnalytics";
import EvidenceTimeline from "@/components/EvidenceTimeline";
import EvidenceExportUI from "@/components/EvidenceExportUI";
import RelevanceScoringDashboard from "@/components/RelevanceScoringDashboard";
import AutoSyncScheduler from "@/components/AutoSyncScheduler";
import { EvidenceGapAnalysisDashboard } from "@/components/EvidenceGapAnalysisDashboard";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Evidence() {
  const [uploadDialogOpen,  setUploadDialogOpen]  = useState(false);
  const [bulkUploadOpen,    setBulkUploadOpen]    = useState(false);
  const [activeTab,         setActiveTab]         = useState("dashboard");
  const [selectedCaseId,    setSelectedCaseId]    = useState<string | null>(null);
  const [refreshKey,        setRefreshKey]        = useState(0);

  // ── Real data ──────────────────────────────────────────────────────────────
  const { data: casesData, isLoading: casesLoading } = trpc.cases.list.useQuery();
  const cases = casesData?.cases ?? [];

  const { data: filesData, refetch: refetchFiles } = trpc.evidenceFiles.search.useQuery(
    { caseId: selectedCaseId ?? undefined },
    { enabled: true }
  );
  const evidenceItems = (filesData as any[]) ?? [];

  // ── Listen for Electron scanner events ────────────────────────────────────
  const handleEvidenceUpdated = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail;
    toast.success(`Scanner upload complete — refreshing evidence...`);
    refetchFiles();
    setRefreshKey(k => k + 1);
    // Auto-switch to dashboard tab so she sees the new files
    setActiveTab("dashboard");
  }, [refetchFiles]);

  useEffect(() => {
    window.addEventListener("laro:evidence-updated", handleEvidenceUpdated);
    return () => window.removeEventListener("laro:evidence-updated", handleEvidenceUpdated);
  }, [handleEvidenceUpdated]);

  // ── Open scan panel via Electron ──────────────────────────────────────────
  const openScanPanel = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.openScanPanel?.();
    } else {
      toast.info("Desktop scanner only available in the LARO Desktop app");
    }
  };

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
              Collect, organise, and analyse all your legal documents
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="lg" variant="outline" onClick={openScanPanel}>
              <Scan className="w-5 h-5 mr-2" />
              Scan Computer
            </Button>
            <Button size="lg" variant="outline" onClick={() => setBulkUploadOpen(true)}>
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
        {casesLoading ? (
          <Card className="border-border/50">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading cases...
            </CardContent>
          </Card>
        ) : cases.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="py-8 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto text-orange-400 mb-3" />
              <p className="font-semibold">No cases yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a case first, then collect evidence for it
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Select a Case
                {selectedCaseId && (
                  <Badge variant="outline" className="ml-2 text-orange-500 border-orange-300">
                    {cases.find((c: any) => c.id === selectedCaseId)?.clientName ?? "Selected"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Choose which case to view evidence for, or leave unselected to see all
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={selectedCaseId === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCaseId(null)}
                  className={selectedCaseId === null ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  All Cases
                </Button>
                {cases.map((c: any) => (
                  <Button
                    key={c.id}
                    variant={selectedCaseId === c.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCaseId(c.id)}
                    className={selectedCaseId === c.id ? "bg-orange-500 hover:bg-orange-600" : ""}
                  >
                    {c.clientName ?? c.caseType ?? "Case"}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {c.status ?? "active"}
                    </Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-8 mb-6">
            <TabsTrigger value="dashboard">
              <BarChart2 className="h-4 w-4 mr-1" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="collection">
              <Cloud className="h-4 w-4 mr-1" /> Collect
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <Clock className="h-4 w-4 mr-1" /> Timeline
            </TabsTrigger>
            <TabsTrigger value="gaps">
              <AlertTriangle className="h-4 w-4 mr-1" /> Gap Analysis
            </TabsTrigger>
            <TabsTrigger value="items">
              <FileText className="h-4 w-4 mr-1" /> Items
            </TabsTrigger>
            <TabsTrigger value="monitoring">
              <Filter className="h-4 w-4 mr-1" /> Monitor
            </TabsTrigger>
            <TabsTrigger value="export">
              <Upload className="h-4 w-4 mr-1" /> Export
            </TabsTrigger>
            <TabsTrigger value="scoring">
              <BarChart2 className="h-4 w-4 mr-1" /> Scoring
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab — real data */}
          <TabsContent value="dashboard">
            <EvidenceSummaryDashboard key={refreshKey} caseId={selectedCaseId ?? undefined} />
          </TabsContent>

          {/* Collect Tab */}
          <TabsContent value="collection" className="space-y-4">
            <EvidenceConnectionsCard />
            {selectedCaseId ? (
              <EvidenceCollection caseId={selectedCaseId} />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Cloud className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-semibold">Select a case above</p>
                  <p className="text-muted-foreground mt-2">
                    Choose a specific case to connect evidence sources to it
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Timeline Tab — real data */}
          <TabsContent value="timeline" className="space-y-4">
            {selectedCaseId ? (
              <EvidenceTimeline
                key={`timeline-${refreshKey}`}
                caseId={selectedCaseId}
              />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-semibold">Select a case above</p>
                  <p className="text-muted-foreground mt-2">
                    Choose a case to see its evidence timeline
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Gap Analysis Tab */}
          <TabsContent value="gaps" className="space-y-4">
            {selectedCaseId ? (
              <EvidenceGapAnalysisDashboard
                key={`gaps-${refreshKey}`}
                caseId={selectedCaseId}
              />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-orange-400 opacity-70" />
                  <p className="text-lg font-semibold">Select a case above</p>
                  <p className="text-muted-foreground mt-2">
                    Choose a case to run gap analysis and find missing documents
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-4">
            <EvidenceCategorization
              key={`items-${refreshKey}`}
              items={evidenceItems}
              onViewItem={(item) => console.log("View:", item)}
              onDownloadItem={(item) => console.log("Download:", item)}
            />
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-4">
            {selectedCaseId ? (
              <CollectionMonitoringDashboard caseId={selectedCaseId} />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">Select a case to view monitoring</p>
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
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Scoring Tab */}
          <TabsContent value="scoring" className="space-y-4">
            {selectedCaseId ? (
              <RelevanceScoringDashboard caseId={selectedCaseId} caseDescription={""} legalArea={""} keyIssues={""} />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">Select a case to score evidence</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {bulkUploadOpen && (
          <BulkEvidenceUpload
            open={bulkUploadOpen}
            onClose={() => { setBulkUploadOpen(false); refetchFiles(); }}
            caseId={selectedCaseId ?? ""}
          />
        )}
      </div>
    </DashboardLayout>
  );
}