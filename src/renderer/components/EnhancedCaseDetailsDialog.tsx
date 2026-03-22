import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { MultiAreaOutreachProgress } from "@/components/OutreachProgressBar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Briefcase,
  Clock,
  Target,
  Send,
  CheckCircle2,
  XCircle,
  Edit,
  Save,
  X,
  TrendingUp,
  MessageSquare,
  Calendar,
  Scale,
  CloudDownload,
} from "lucide-react";
import { LegalAreasSelect } from "@/components/LegalAreasSelect";
import { EvidenceCollection } from "@/components/EvidenceCollection";
import TimelineView, { TimelineEvent } from "@/components/TimelineView";
import CommunicationHub from "@/components/CommunicationHub";
import EvidenceTimelineView from "@/components/EvidenceTimelineView";
import OutreachAnalyticsView from "@/components/OutreachAnalyticsView";
import { EvidenceGapAnalysisDashboard } from "@/components/EvidenceGapAnalysisDashboard";
import EnhancedEvidenceUpload from "@/components/EnhancedEvidenceUpload";
// Removed old GoogleDriveFilePicker - using enhanced integration instead
import { AutoCollectionSettings } from "@/components/AutoCollectionSettings";
import { CollectionMonitoringDashboard } from "@/components/CollectionMonitoringDashboard";
import ProgressTrackingDashboard from "@/components/ProgressTrackingDashboard";
import { exportCaseSummary, printCaseSummary } from "@/lib/export";
import { Download, Printer } from "lucide-react";
import CaseStatusWorkflow from "@/components/CaseStatusWorkflow";
import { CardDescription } from "@/components/ui/card";

// Google Drive integration moved to Evidence page with enhanced component

interface EnhancedCaseDetailsDialogProps {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Wrapper component to fetch and display outreach progress
function OutreachProgressVisualization({ caseId }: { caseId: string }) {
  const { data, isLoading } = trpc.cases.outreachProgress.useQuery({ caseId });
  
  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!data || data.legalAreas.length === 0) {
    return null; // Don't show if no data
  }
  
  return (
    <MultiAreaOutreachProgress
      caseId={caseId}
      legalAreas={data.legalAreas}
      overallStats={data.overallStats}
    />
  );
}

export default function EnhancedCaseDetailsDialog({
  caseId,
  open,
  onOpenChange,
}: EnhancedCaseDetailsDialogProps) {
  const [selectedDistance, setSelectedDistance] = useState(50);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCase, setEditedCase] = useState<any>(null);
  
  // Tab state persistence
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(`case-tab-${caseId}`);
    return saved || "overview";
  });
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem(`case-tab-${caseId}`, value);
  };
  
  const { data: caseData, isLoading: caseLoading, refetch: refetchCase } = trpc.cases.byId.useQuery(caseId, {
    enabled: open && !!caseId,
  });

  const { data: matchedLawyers, isLoading: matchingLoading, refetch: refetchMatches } = trpc.matching.findLawyers.useQuery(
    {
      caseId,
      maxDistance: selectedDistance,
      maxResults: 10,
    },
    {
      enabled: open && !!caseId,
    }
  );

  const { data: outreachHistory } = trpc.outreach.byCaseId.useQuery(caseId, {
    enabled: open && !!caseId,
  });

  const initiateOutreachMutation = trpc.workflow.initiateOutreach.useMutation({
    onSuccess: () => {
      toast.success("Outreach initiated successfully!");
      refetchMatches();
      refetchCase();
    },
    onError: (error) => {
      toast.error(`Failed to initiate outreach: ${error.message}`);
    },
  });

  const handleInitiateOutreach = () => {
    if (!caseId) return;
    initiateOutreachMutation.mutate({ caseId });
  };

  const handleEdit = () => {
    setEditedCase(caseData);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedCase(null);
  };

  const updateCaseMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("Case updated successfully!");
      setIsEditing(false);
      setEditedCase(null);
      refetchCase();
    },
    onError: (error) => {
      toast.error(`Failed to update case: ${error.message}`);
    },
  });

  const handleSaveEdit = () => {
    if (!editedCase || !caseId) return;
    
    updateCaseMutation.mutate({
      id: caseId,
      caseSummary: editedCase.caseSummary,
      urgency: editedCase.urgency,
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-card border-border/50">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Case Details
              </DialogTitle>
              <DialogDescription>
                Comprehensive case management and lawyer matching
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => exportCaseSummary(caseData)}
                variant="outline"
                size="sm"
                className="border-green-500/30 hover:bg-green-500/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={() => printCaseSummary(caseData)}
                variant="outline"
                size="sm"
                className="border-blue-500/30 hover:bg-blue-500/10"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              {!isEditing && (
                <Button
                  onClick={handleEdit}
                  variant="outline"
                  size="sm"
                  className="border-purple-500/30 hover:bg-purple-500/10"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Case
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {caseLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : caseData ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-11 bg-card/50">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="evidence-timeline">Evidence Timeline</TabsTrigger>
              <TabsTrigger value="gap-analysis">Gap Analysis</TabsTrigger>
              <TabsTrigger value="matching">Lawyers</TabsTrigger>
              <TabsTrigger value="outreach">Outreach</TabsTrigger>
              <TabsTrigger value="outreach-analytics">Outreach Analytics</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Your Case Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Client Name</Label>
                        <Input
                          value={editedCase?.clientName || ""}
                          onChange={(e) =>
                            setEditedCase({ ...editedCase, clientName: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={editedCase?.clientEmail || ""}
                          onChange={(e) =>
                            setEditedCase({ ...editedCase, clientEmail: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={editedCase?.clientPhone || ""}
                          onChange={(e) =>
                            setEditedCase({ ...editedCase, clientPhone: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Case Type</Label>
                        <Input
                          value={editedCase?.caseType || ""}
                          onChange={(e) =>
                            setEditedCase({ ...editedCase, caseType: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <select
                          value={editedCase?.urgency || "Medium"}
                          onChange={(e) =>
                            setEditedCase({ ...editedCase, urgency: e.target.value as "Low" | "Medium" | "High" })
                          }
                          className="w-full px-3 py-2 bg-background border border-input rounded-md"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Label>Case Summary</Label>
                        <Textarea
                          value={editedCase?.caseSummary || ""}
                          onChange={(e) =>
                            setEditedCase({ ...editedCase, caseSummary: e.target.value })
                          }
                          rows={6}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Legal Areas</Label>
                        <LegalAreasSelect
                          value={editedCase?.legalAreas ? JSON.parse(editedCase.legalAreas as string) : []}
                          onChange={(areas) =>
                            setEditedCase({ ...editedCase, legalAreas: JSON.stringify(areas) as any })
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Adjust the legal areas if the AI classification needs correction
                        </p>
                      </div>
                      <div className="col-span-2 flex gap-2">
                        <Button onClick={handleSaveEdit} className="bg-green-500 hover:bg-green-600">
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button onClick={handleCancelEdit} variant="outline">
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Client Name</p>
                        <p className="font-medium">{caseData.clientName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {caseData.clientEmail}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {caseData.clientPhone}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="font-medium flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {caseData.clientAddress || "No address provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Case Type</p>
                        <p className="font-medium">{caseData.caseType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant="secondary">{caseData.status}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Priority</p>
                        <Badge
                          variant="outline"
                          className={
                            caseData.urgency === "High"
                              ? "border-red-500/50 text-red-400"
                              : caseData.urgency === "Medium"
                              ? "border-yellow-500/50 text-yellow-400"
                              : "border-green-500/50 text-green-400"
                          }
                        >
                          {caseData.urgency}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {caseData.createdAt ? new Date(caseData.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground mb-2">Case Summary</p>
                        <p className="text-sm bg-card/80 p-3 rounded-md border border-border/30">
                          {caseData.caseSummary}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                          <Scale className="w-4 h-4" />
                          Legal Areas {caseData.legalAreas && JSON.parse(caseData.legalAreas as string).length > 0 && (
                            <span className="text-xs text-muted-foreground/70">(AI-detected, editable)</span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {caseData.legalAreas && JSON.parse(caseData.legalAreas as string).length > 0 ? (
                            JSON.parse(caseData.legalAreas as string).map((area: any, index: number) => (
                              <Badge key={index} variant="secondary" className="bg-purple-500/10 text-purple-300 border-purple-500/30">
                                {typeof area === 'string' ? area : area.area || area.areaEn || 'Unknown'}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No legal areas assigned yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Status Tab */}
            <TabsContent value="status" className="space-y-4">
              <CaseStatusWorkflow
                currentStatus={caseData.status}
                onStatusChange={(newStatus) => {
                  updateCase.mutate(
                    { id: caseId, status: newStatus as any },
                    {
                      onSuccess: () => {
                        toast.success("Case status updated successfully");
                        caseRefetch();
                      },
                      onError: () => {
                        toast.error("Failed to update case status");
                      },
                    }
                  );
                }}
                canEdit={true}
              />
            </TabsContent>

            {/* Progress Tracking Tab */}
            <TabsContent value="progress" className="space-y-4">
              <ProgressTrackingDashboard caseId={caseId} />
            </TabsContent>

            {/* Evidence Tab */}
            <TabsContent value="evidence" className="space-y-4">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-card/50">
                  <TabsTrigger value="upload">Upload</TabsTrigger>
                  <TabsTrigger value="google-drive">Google Drive</TabsTrigger>
                  <TabsTrigger value="auto-collection">Auto-Collection</TabsTrigger>
                  <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload" className="space-y-4 mt-4">
                  <EnhancedEvidenceUpload caseId={caseId} />
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">Existing Evidence</h3>
                    <EvidenceCollection caseId={caseId} />
                  </div>
                </TabsContent>
                
                <TabsContent value="google-drive" className="space-y-4 mt-4">
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CloudDownload className="w-5 h-5" />
                        Import from Google Drive
                      </CardTitle>
                      <CardDescription>
                        Select files from your connected Google Drive account to add as evidence.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Google Drive integration has been moved to the Evidence page.</p>
                        <p className="text-sm mt-2">Go to the Evidence tab to connect and sync your Google Drive.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="auto-collection" className="space-y-4 mt-4">
                  <AutoCollectionSettings caseId={caseId} />
                </TabsContent>
                
                <TabsContent value="monitoring" className="space-y-4 mt-4">
                  <CollectionMonitoringDashboard caseId={caseId} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Matching Tab */}
            <TabsContent value="matching" className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Search Radius: {selectedDistance} km
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={selectedDistance}
                    onChange={(e) => setSelectedDistance(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <Button
                  onClick={() => refetchMatches()}
                  variant="outline"
                  className="border-purple-500/30 hover:bg-purple-500/10"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Matched Lawyers ({matchedLawyers?.length || 0})
                </h3>
                {matchedLawyers && matchedLawyers.length > 0 && (
                  <Button
                    onClick={handleInitiateOutreach}
                    disabled={initiateOutreachMutation.isPending}
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {initiateOutreachMutation.isPending ? "Initiating..." : "Start Outreach"}
                  </Button>
                )}
              </div>

              {matchingLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-40 w-full" />
                  ))}
                </div>
              ) : matchedLawyers && matchedLawyers.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {matchedLawyers.map((lawyer: any, index: number) => (
                    <Card
                      key={lawyer.id}
                      className="border-border/50 bg-card/50 hover:bg-card/80 transition-all"
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                #{index + 1}
                              </div>
                              <div>
                                <h4 className="font-semibold text-lg">{lawyer.name}</h4>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {lawyer.distance} km away
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-3">
                              {lawyer.email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                  <span>{lawyer.email}</span>
                                </div>
                              )}
                              {lawyer.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-4 h-4 text-muted-foreground" />
                                  <span>{lawyer.phone}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2 mb-3">
                              {lawyer.legalAreas?.map((area: any, i: number) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="bg-blue-500/20 text-blue-300 border-blue-500/30"
                                >
                                  {typeof area === 'string' ? area : area.area || area.areaEn || 'Unknown'}
                                </Badge>
                              ))}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {lawyer.matchReasons?.map((reason: string, i: number) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs border-green-500/30 text-green-400"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="text-right space-y-2">
                            <div>
                              <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                                {lawyer.matchScore}
                              </div>
                              <p className="text-xs text-muted-foreground">Total Score (max 210)</p>
                            </div>
                            
                            {/* Score Breakdown */}
                            <div className="text-xs space-y-1 text-left">
                              {lawyer.caseLoadScore !== undefined && (
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Case-load:</span>
                                  <span className="font-medium text-green-400">{lawyer.caseLoadScore}/50</span>
                                </div>
                              )}
                              {lawyer.responseTimeScore !== undefined && (
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Response Time:</span>
                                  <span className="font-medium text-blue-400">{lawyer.responseTimeScore}/50</span>
                                </div>
                              )}
                              {lawyer.acceptanceRateScore !== undefined && (
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Acceptance Rate:</span>
                                  <span className="font-medium text-purple-400">{lawyer.acceptanceRateScore}/50</span>
                                </div>
                              )}
                              {lawyer.capacityScore !== undefined && (
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Capacity:</span>
                                  <span className="font-medium text-yellow-400">{lawyer.capacityScore}/20</span>
                                </div>
                              )}
                              {lawyer.distanceScore !== undefined && (
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Distance:</span>
                                  <span className="font-medium text-cyan-400">{lawyer.distanceScore}/10</span>
                                </div>
                              )}
                              {lawyer.experienceScore !== undefined && (
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Experience:</span>
                                  <span className="font-medium text-orange-400">{lawyer.experienceScore}/10</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-border/50 bg-card/50">
                  <CardContent className="pt-6 text-center">
                    <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No matching lawyers found within {selectedDistance} km radius.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Try increasing the search radius or check case requirements.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Outreach History Tab */}
            <TabsContent value="outreach" className="space-y-4">
              {/* Multi-Discipline Outreach Progress Visualization */}
              <OutreachProgressVisualization caseId={caseId} />
              
              {/* Detailed Outreach History */}
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Lawyers We've Contacted for You
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {outreachHistory && outreachHistory.length > 0 ? (
                    <div className="space-y-4">
                      {outreachHistory.map((outreach: any) => (
                        <div
                          key={outreach.id}
                          className="border-l-2 border-purple-500/30 pl-4 py-2"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium">{outreach.lawyerName || "Unknown Lawyer"}</p>
                            <Badge
                              variant={
                                outreach.status === "Interested"
                                  ? "default"
                                  : outreach.status === "Declined"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {outreach.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Distance: {outreach.distanceKm} km
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Initial Contact: {new Date(outreach.initialContact).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Follow-ups Sent: {outreach.followUpsSent}
                          </p>
                          {outreach.response && (
                            <p className="text-sm mt-2 bg-card/80 p-2 rounded border border-border/30">
                              {outreach.response}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No outreach history yet. Start matching lawyers to begin outreach.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Gap Analysis Tab */}
            <TabsContent value="gap-analysis" className="space-y-4">
              <EvidenceGapAnalysisDashboard caseId={caseId} />
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="space-y-4">
              <TimelineView
                events={[
                  {
                    id: "case-created",
                    date: caseData.createdAt ? new Date(caseData.createdAt) : new Date(),
                    type: "case_created",
                    title: "Case Created",
                    description: `Case for ${caseData.clientName} was created with ${caseData.urgency} priority`,
                    metadata: {
                      urgency: caseData.urgency,
                      caseType: caseData.caseType,
                    },
                  },
                  ...(outreachHistory?.map((outreach: any) => ({
                    id: `outreach-${outreach.id}`,
                    date: new Date(outreach.initialContact),
                    type: "lawyer_contacted" as const,
                    title: "Lawyer Contacted",
                    description: `Reached out to ${outreach.lawyerName || "lawyer"}`,
                    metadata: {
                      lawyer: outreach.lawyerName,
                      status: outreach.status,
                      distance: `${outreach.distanceKm} km`,
                    },
                  })) || []),
                  ...(outreachHistory?.filter((o: any) => o.response).map((outreach: any) => ({
                    id: `response-${outreach.id}`,
                    date: outreach.lastContact ? new Date(outreach.lastContact) : new Date(outreach.initialContact),
                    type: "response_received" as const,
                    title: "Response Received",
                    description: outreach.response || "Lawyer responded to outreach",
                    metadata: {
                      lawyer: outreach.lawyerName,
                    },
                  })) || []),
                ]}
              />
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="space-y-4">
              <CommunicationHub caseId={caseId} />
            </TabsContent>

            {/* Evidence Timeline Tab */}
            <TabsContent value="evidence-timeline" className="space-y-4">
              <EvidenceTimelineView caseId={caseId} />
            </TabsContent>

            {/* Outreach Analytics Tab */}
            <TabsContent value="outreach-analytics" className="space-y-4">
              <OutreachAnalyticsView caseId={caseId} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Case not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

