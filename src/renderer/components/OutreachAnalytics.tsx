import { useState } from "react";
import { BarChart3, CheckCircle2, Clock, Mail, Target, TrendingUp, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function percent(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

function duration(hours: number | undefined): string {
  if (!hours) return "n/a";
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

function Metric({ label, value, icon: Icon, loading }: { label: string; value: string; icon: typeof Mail; loading: boolean }) {
  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-semibold">{value}</div>}</CardContent>
    </Card>
  );
}

export default function OutreachAnalytics() {
  const [days, setDays] = useState("30");
  const metrics = trpc.outreachAnalytics.getOverallMetrics.useQuery();
  const trends = trpc.outreachAnalytics.getPerformanceTrends.useQuery({ days: Number(days) });
  const lawyers = trpc.outreachAnalytics.getResponseRateByLawyer.useQuery({ limit: 20 });
  const legalAreas = trpc.outreachAnalytics.getTimeToMatchByLegalArea.useQuery();
  const regions = trpc.outreachAnalytics.getMatchSuccessByRegion.useQuery();
  const data = metrics.data;
  const pipelineMax = Math.max(1, data?.prepared ?? 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Outreach</h1>
            <p className="mt-1 text-sm text-muted-foreground">Results and response progress across your cases</p>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36" aria-label="Reporting period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Prepared" value={String(data?.prepared ?? 0)} icon={Mail} loading={metrics.isLoading} />
          <Metric label="Sent" value={String(data?.sent ?? 0)} icon={TrendingUp} loading={metrics.isLoading} />
          <Metric label="Response rate" value={percent(data?.overallResponseRate)} icon={Users} loading={metrics.isLoading} />
          <Metric label="Interested" value={String(data?.interested ?? 0)} icon={Target} loading={metrics.isLoading} />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader><CardTitle className="text-base">Pipeline</CardTitle></CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-4">
                {[
                  ["Prepared", data?.prepared ?? 0],
                  ["Approved", data?.approved ?? 0],
                  ["Sent", data?.sent ?? 0],
                  ["Responses", data?.responses ?? 0],
                ].map(([label, count]) => (
                  <div key={String(label)} className="space-y-2">
                    <div className="flex items-center justify-between text-sm"><span>{label}</span><strong>{count}</strong></div>
                    <Progress value={(Number(count) / pipelineMax) * 100} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card className="border-border/50">
                <CardHeader><CardTitle className="text-base">Activity by day</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  {trends.isLoading ? <Skeleton className="h-32 w-full" /> : trends.data?.length ? (
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="text-left text-muted-foreground"><tr><th className="pb-2 font-medium">Date</th><th>Prepared</th><th>Sent</th><th>Responses</th><th>Interested</th></tr></thead>
                      <tbody>{trends.data.map((row) => <tr key={row.date} className="border-t border-border/40"><td className="py-2">{row.date}</td><td>{row.prepared}</td><td>{row.sent}</td><td>{row.responses}</td><td>{row.interested}</td></tr>)}</tbody>
                    </table>
                  ) : <p className="py-8 text-center text-sm text-muted-foreground">No outreach in this period.</p>}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader><CardTitle className="text-base">Response quality</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Acceptance rate</span><strong>{percent(data?.acceptanceRate)}</strong></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" />Average response</span><strong>{duration(data?.averageResponseTimeHours)}</strong></div>
                  <div className="flex items-center justify-between"><span>Declined</span><Badge variant="secondary">{data?.declined ?? 0}</Badge></div>
                  <div className="flex items-center justify-between"><span>Rejected before send</span><Badge variant="secondary">{data?.rejected ?? 0}</Badge></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="grid gap-4 xl:grid-cols-3">
            <Card className="border-border/50 xl:col-span-2">
              <CardHeader><CardTitle className="text-base">Lawyer performance</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {lawyers.isLoading ? <Skeleton className="h-32 w-full" /> : lawyers.data?.length ? lawyers.data.map((lawyer) => (
                  <div key={lawyer.lawyerId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border/40 py-2 last:border-0">
                    <span className="truncate text-sm font-medium">{lawyer.name}</span>
                    <span className="text-xs text-muted-foreground">{lawyer.responses}/{lawyer.totalOutreach} responses</span>
                    <Badge variant="outline">{percent(lawyer.responseRate)}</Badge>
                  </div>
                )) : <p className="py-8 text-center text-sm text-muted-foreground">No sent outreach yet.</p>}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader><CardTitle className="text-base">Time to match</CardTitle></CardHeader>
                <CardContent className="space-y-2">{legalAreas.data?.length ? legalAreas.data.map((area) => <div key={area.legalArea} className="flex justify-between gap-3 text-sm"><span className="truncate">{area.legalArea}</span><strong>{area.avgDays.toFixed(1)}d</strong></div>) : <p className="text-sm text-muted-foreground">No accepted matches yet.</p>}</CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader><CardTitle className="text-base">Interested by region</CardTitle></CardHeader>
                <CardContent className="space-y-2">{regions.data?.length ? regions.data.map((region) => <div key={region.region} className="flex justify-between gap-3 text-sm"><span className="truncate">{region.region}</span><Badge variant="secondary">{region.matches}</Badge></div>) : <p className="text-sm text-muted-foreground">No regional results yet.</p>}</CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
