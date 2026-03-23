import React, { useState, useMemo } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Mail, FileText, MessageSquare, CheckCircle2, AlertCircle,
  Download, RefreshCw, Loader2, FolderOpen,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface EvidenceSummaryDashboardProps {
  caseId?: string;
}

const SOURCE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  gmail:          { icon: <Mail className="w-4 h-4" />,          color: "#EA4335", label: "Gmail" },
  outlook:        { icon: <Mail className="w-4 h-4" />,          color: "#0078D4", label: "Outlook" },
  slack:          { icon: <MessageSquare className="w-4 h-4" />, color: "#36C5F0", label: "Slack" },
  trello:         { icon: <CheckCircle2 className="w-4 h-4" />,  color: "#0052CC", label: "Trello" },
  "google-drive": { icon: <FileText className="w-4 h-4" />,      color: "#4285F4", label: "Google Drive" },
  onedrive:       { icon: <FileText className="w-4 h-4" />,      color: "#0078D4", label: "OneDrive" },
  telegram:       { icon: <MessageSquare className="w-4 h-4" />, color: "#0088cc", label: "Telegram" },
  manual:         { icon: <FileText className="w-4 h-4" />,      color: "#9CA3AF", label: "Manual Upload" },
  agent:          { icon: <FolderOpen className="w-4 h-4" />,    color: "#F97316", label: "Desktop Scan" },
};

export default function EvidenceSummaryDashboard({ caseId }: EvidenceSummaryDashboardProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  // ── Real tRPC queries ────────────────────────────────────────────────────
  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } =
    trpc.evidenceFiles.search.useQuery(
      { caseId: caseId ?? undefined },
      { enabled: true }
    );

  const { data: analyticsData, refetch: refetchAnalytics } =
    trpc.evidenceAnalytics.getStats.useQuery();

  const { data: uploadTimeline, refetch: refetchTimeline } =
    trpc.evidenceAnalytics.getUploadTimeline.useQuery(
      { days: 30 },
      { enabled: true }
    );

  const { data: sourceBreakdown, refetch: refetchSources } =
    trpc.evidenceAnalytics.getUploadSourceBreakdown.useQuery();

  const { data: fileTypeData, refetch: refetchTypes } =
    trpc.evidenceAnalytics.getFileTypeDistribution.useQuery();

  const isLoading = filesLoading;

  // ── Derived stats ─────────────────────────────────────────────────────────
  const files = (filesData as any[]) ?? [];

  const stats = useMemo(() => {
    const sourceStats: Record<string, number> = {};
    const typeStats: Record<string, number> = {};
    let totalRelevant = 0;
    let totalSizeBytes = 0;

    files.forEach((f: any) => {
      const src = f.uploadSource === "agent" ? "agent" : (f.source ?? f.uploadSource ?? "manual");
      sourceStats[src] = (sourceStats[src] || 0) + 1;

      const ft = f.fileType ?? f.mimeType?.split("/")[0] ?? f.type ?? "other";
      typeStats[ft] = (typeStats[ft] || 0) + 1;

      if (f.relevant !== false) totalRelevant++;
      totalSizeBytes += parseInt(f.fileSize ?? "0") || 0;
    });

    const totalFiles = analyticsData?.totalFiles ?? files.length;
    const sizeLabel = totalSizeBytes > 1024 * 1024
      ? `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(totalSizeBytes / 1024).toFixed(0)} KB`;

    return {
      total: totalFiles,
      relevant: totalRelevant,
      irrelevant: totalFiles - totalRelevant,
      totalSize: sizeLabel,
      sourceStats,
      typeStats,
      manualUploads: analyticsData?.manualUploads ?? 0,
      agentUploads:  analyticsData?.agentUploads  ?? 0,
    };
  }, [files, analyticsData]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const sourceChartData = useMemo(() => {
    const breakdown = (sourceBreakdown as any[]) ?? [];
    if (breakdown.length > 0) {
      return breakdown.map((r: any) => ({
        name:  SOURCE_CONFIG[r.source]?.label ?? r.source,
        value: Number(r.count),
        fill:  SOURCE_CONFIG[r.source]?.color ?? "#9CA3AF",
      }));
    }
    return Object.entries(stats.sourceStats).map(([source, count]) => ({
      name:  SOURCE_CONFIG[source]?.label ?? source,
      value: count,
      fill:  SOURCE_CONFIG[source]?.color ?? "#9CA3AF",
    }));
  }, [sourceBreakdown, stats.sourceStats]);

  const typeChartData = useMemo(() => {
    const types = (fileTypeData as any[]) ?? [];
    if (types.length > 0) {
      return types.map((r: any) => ({ name: r.fileType ?? "Other", value: Number(r.count) }));
    }
    return Object.entries(stats.typeStats).map(([type, count]) => ({
      name:  type.charAt(0).toUpperCase() + type.slice(1),
      value: count,
    }));
  }, [fileTypeData, stats.typeStats]);

  const timelineChartData = useMemo(() => {
    const tl = (uploadTimeline as any[]) ?? [];
    if (tl.length > 0) return tl.map((r: any) => ({ date: r.date, count: Number(r.count) }));
    return [];
  }, [uploadTimeline]);

  const relevanceData = [
    { name: "Relevant",     value: stats.relevant,   fill: "#10B981" },
    { name: "Not Relevant", value: stats.irrelevant,  fill: "#EF4444" },
  ];

  const filteredItems = useMemo(() => {
    if (!selectedSource) return files;
    return files.filter((f: any) => {
      const src = f.uploadSource === "agent" ? "agent" : (f.source ?? f.uploadSource ?? "manual");
      return src === selectedSource;
    });
  }, [selectedSource, files]);

  // ── Refresh ────────────────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchFiles(), refetchAnalytics(), refetchTimeline(), refetchSources(), refetchTypes()]);
      toast.success("Evidence data refreshed");
    } catch {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Evidence Summary</h2>
          <p className="text-muted-foreground mt-1">
            {caseId ? "Evidence for this case" : "All collected evidence across all cases"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="ml-3 text-muted-foreground">Loading evidence...</span>
        </div>
      )}

      {/* KPI Cards */}
      {!isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Evidence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">Items collected</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Relevant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.relevant}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.total > 0 ? ((stats.relevant / stats.total) * 100).toFixed(0) : 0}% of total
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Data Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{Object.keys(stats.sourceStats).length}</div>
                <p className="text-xs text-muted-foreground mt-1">Connected platforms</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Desktop Scans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.agentUploads}</div>
                <p className="text-xs text-muted-foreground mt-1">From local scanner</p>
              </CardContent>
            </Card>
          </div>

          {/* Empty state */}
          {stats.total === 0 && (
            <Card className="border-dashed border-2 border-border/50">
              <CardContent className="py-16 text-center">
                <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No evidence yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Upload files, connect your email accounts, or use the desktop scanner (Ctrl+Shift+S) to start collecting evidence.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          {stats.total > 0 && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="items">Items ({stats.total})</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Evidence by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={typeChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#F97316" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Relevance Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={relevanceData} cx="50%" cy="50%" outerRadius={80}
                            label={({ name, value }) => `${name}: ${value}`} dataKey="value">
                            {relevanceData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Sources */}
              <TabsContent value="sources" className="space-y-4">
                <Card className="border-border/50 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Evidence by Source</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={sourceChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#F97316" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(stats.sourceStats).map(([source, count]) => (
                    <Card key={source}
                      className={`cursor-pointer transition-all border-border/50 bg-card/50 ${selectedSource === source ? "ring-2 ring-orange-500" : "hover:border-orange-300"}`}
                      onClick={() => setSelectedSource(selectedSource === source ? null : source)}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {SOURCE_CONFIG[source]?.icon}
                          <span className="font-medium text-sm">{SOURCE_CONFIG[source]?.label ?? source}</span>
                        </div>
                        <div className="text-2xl font-bold">{count}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Timeline */}
              <TabsContent value="timeline" className="space-y-4">
                <Card className="border-border/50 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Collection Timeline (Last 30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {timelineChartData.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        No timeline data yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={timelineChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="count" stroke="#F97316"
                            strokeWidth={2} dot={{ fill: "#F97316", r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Items */}
              <TabsContent value="items" className="space-y-4">
                <Card className="border-border/50 bg-card/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {selectedSource ? `${SOURCE_CONFIG[selectedSource]?.label ?? selectedSource} Items` : "All Evidence Items"}
                      </CardTitle>
                      {selectedSource && (
                        <Button variant="outline" size="sm" onClick={() => setSelectedSource(null)}>
                          Clear filter
                        </Button>
                      )}
                    </div>
                    <CardDescription>{filteredItems.length} items</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredItems.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">No items found</p>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {filteredItems.map((item: any) => {
                          const src = item.uploadSource === "agent" ? "agent" : (item.source ?? item.uploadSource ?? "manual");
                          return (
                            <div key={item.id}
                              className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors">
                              <div className="flex items-center gap-3 flex-1">
                                {SOURCE_CONFIG[src]?.icon ?? <FileText className="w-4 h-4" />}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{item.fileName ?? item.title ?? item.name ?? "Untitled"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {SOURCE_CONFIG[src]?.label ?? src} • {new Date(item.uploadedAt ?? item.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.relevant !== false
                                  ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  : <AlertCircle className="w-4 h-4 text-red-600" />}
                                <Badge variant="outline" className="text-xs">{item.fileType ?? item.mimeType?.split("/")[1] ?? "file"}</Badge>
                                <span className="text-xs text-muted-foreground">{item.fileSize ?? ""}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}