import React, { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Mail,
  FileText,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Calendar,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface EvidenceItem {
  id: string;
  name: string;
  source: "gmail" | "outlook" | "slack" | "trello" | "google-drive" | "onedrive" | "telegram" | "manual";
  type: "email" | "document" | "message" | "file" | "task" | "other";
  uploadedAt: Date;
  size: string;
  relevant: boolean;
  caseId?: string;
  tags: string[];
  lastModified?: Date;
  content?: string;
}

interface SourceStats {
  source: string;
  count: number;
  lastSync: Date | null;
  icon: React.ReactNode;
  color: string;
}

const SOURCE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  gmail: { icon: <Mail className="w-4 h-4" />, color: "#EA4335", label: "Gmail" },
  outlook: { icon: <Mail className="w-4 h-4" />, color: "#0078D4", label: "Outlook" },
  slack: { icon: <MessageSquare className="w-4 h-4" />, color: "#36C5F0", label: "Slack" },
  trello: { icon: <CheckCircle2 className="w-4 h-4" />, color: "#0052CC", label: "Trello" },
  "google-drive": { icon: <FileText className="w-4 h-4" />, color: "#4285F4", label: "Google Drive" },
  onedrive: { icon: <FileText className="w-4 h-4" />, color: "#0078D4", label: "OneDrive" },
  telegram: { icon: <MessageSquare className="w-4 h-4" />, color: "#0088cc", label: "Telegram" },
  manual: { icon: <FileText className="w-4 h-4" />, color: "#9CA3AF", label: "Manual Upload" },
};

export default function EvidenceSummaryDashboard() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"week" | "month" | "all">("month");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock data - replace with actual tRPC calls
  const mockEvidenceItems: EvidenceItem[] = [
    {
      id: "1",
      name: "Termination Notice Email",
      source: "gmail",
      type: "email",
      uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      size: "45 KB",
      relevant: true,
      tags: ["termination", "important"],
    },
    {
      id: "2",
      name: "Employment Contract",
      source: "google-drive",
      type: "document",
      uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      size: "256 KB",
      relevant: true,
      tags: ["contract", "employment"],
    },
    {
      id: "3",
      name: "Slack Conversation Thread",
      source: "slack",
      type: "message",
      uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      size: "12 KB",
      relevant: true,
      tags: ["communication", "evidence"],
    },
    {
      id: "4",
      name: "Witness Statement",
      source: "manual",
      type: "document",
      uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      size: "89 KB",
      relevant: true,
      tags: ["witness"],
    },
    {
      id: "5",
      name: "Project Task Board",
      source: "trello",
      type: "task",
      uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      size: "34 KB",
      relevant: false,
      tags: ["project"],
    },
    {
      id: "6",
      name: "Outlook Meeting Notes",
      source: "outlook",
      type: "email",
      uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      size: "28 KB",
      relevant: true,
      tags: ["meeting", "notes"],
    },
  ];

  // Calculate statistics
  const stats = useMemo(() => {
    const sourceStats: Record<string, number> = {};
    const typeStats: Record<string, number> = {};
    let totalRelevant = 0;
    let totalSize = 0;

    mockEvidenceItems.forEach((item) => {
      sourceStats[item.source] = (sourceStats[item.source] || 0) + 1;
      typeStats[item.type] = (typeStats[item.type] || 0) + 1;
      if (item.relevant) totalRelevant++;
      totalSize += parseInt(item.size) || 0;
    });

    return {
      total: mockEvidenceItems.length,
      relevant: totalRelevant,
      irrelevant: mockEvidenceItems.length - totalRelevant,
      totalSize: `${(totalSize / 1024).toFixed(2)} MB`,
      sourceStats,
      typeStats,
    };
  }, []);

  // Prepare chart data
  const sourceChartData = useMemo(() => {
    return Object.entries(stats.sourceStats).map(([source, count]) => ({
      name: SOURCE_CONFIG[source]?.label || source,
      value: count,
      fill: SOURCE_CONFIG[source]?.color || "#9CA3AF",
    }));
  }, [stats.sourceStats]);

  const typeChartData = useMemo(() => {
    return Object.entries(stats.typeStats).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: count,
    }));
  }, [stats.typeStats]);

  const timelineData = useMemo(() => {
    const grouped: Record<string, number> = {};
    mockEvidenceItems.forEach((item) => {
      const date = new Date(item.uploadedAt);
      const key = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, []);

  const relevanceData = [
    { name: "Relevant", value: stats.relevant, fill: "#10B981" },
    { name: "Not Relevant", value: stats.irrelevant, fill: "#EF4444" },
  ];

  const filteredItems = useMemo(() => {
    return selectedSource
      ? mockEvidenceItems.filter((item) => item.source === selectedSource)
      : mockEvidenceItems;
  }, [selectedSource]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate refresh
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success("Evidence data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh evidence data");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Evidence Summary</h2>
          <p className="text-muted-foreground mt-1">
            Overview of all collected evidence from multiple sources
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Evidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Items collected
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Relevant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.relevant}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((stats.relevant / stats.total) * 100).toFixed(0)}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Data Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Object.keys(stats.sourceStats).length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Connected platforms
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalSize}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Storage used
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Evidence Type Distribution */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Evidence by Type</CardTitle>
                <CardDescription>Distribution of evidence types</CardDescription>
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

            {/* Relevance Distribution */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Relevance Status</CardTitle>
                <CardDescription>Relevant vs. non-relevant evidence</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={relevanceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {relevanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Evidence by Source</CardTitle>
              <CardDescription>Distribution across connected platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
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

          {/* Source Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.sourceStats).map(([source, count]) => (
              <Card
                key={source}
                className={`cursor-pointer transition-all border-border/50 bg-card/50 backdrop-blur-sm ${
                  selectedSource === source
                    ? "ring-2 ring-orange-500"
                    : "hover:border-orange-300"
                }`}
                onClick={() =>
                  setSelectedSource(selectedSource === source ? null : source)
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {SOURCE_CONFIG[source]?.icon}
                      <div>
                        <p className="font-semibold text-sm">
                          {SOURCE_CONFIG[source]?.label || source}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {count} items
                        </p>
                      </div>
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Collection Timeline</CardTitle>
              <CardDescription>Evidence collected over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#F97316"
                    strokeWidth={2}
                    dot={{ fill: "#F97316", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {selectedSource
                      ? `${SOURCE_CONFIG[selectedSource]?.label || selectedSource} Items`
                      : "All Evidence Items"}
                  </CardTitle>
                  <CardDescription>
                    {filteredItems.length} items
                    {selectedSource && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setSelectedSource(null)}
                        className="ml-2"
                      >
                        Clear filter
                      </Button>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {SOURCE_CONFIG[item.source]?.icon}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {SOURCE_CONFIG[item.source]?.label} • {item.uploadedAt.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.relevant && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                      {!item.relevant && (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-xs text-muted-foreground">{item.size}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
