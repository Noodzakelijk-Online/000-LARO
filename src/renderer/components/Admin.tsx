import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Activity, Briefcase, Scale, Send, Users } from "lucide-react";

const metricCards = [
  { key: "totalUsers", label: "Users", icon: Users },
  { key: "totalCases", label: "Cases", icon: Briefcase },
  { key: "totalLawyers", label: "Lawyers", icon: Scale },
  { key: "totalOutreach", label: "Outreach records", icon: Send },
] as const;

export default function Admin() {
  const { user } = useAuth();
  const enabled = user?.role === "admin";
  const overview = trpc.adminAnalytics.overview.useQuery(undefined, { enabled });
  const funnel = trpc.adminAnalytics.conversionFunnel.useQuery(undefined, { enabled });
  const usage = trpc.adminAnalytics.usageMetrics.useQuery(undefined, { enabled });
  const topUsers = trpc.adminAnalytics.topUsers.useQuery(undefined, { enabled });

  if (!enabled) {
    return (
      <DashboardLayout>
        <main className="p-6">
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="mt-2 text-sm text-muted-foreground">Administrator access is required.</p>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="space-y-6 p-4 md:p-6">
        <header>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Administration</h1>
            <Badge variant="outline">Live database</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Current operating totals and workflow conversion.</p>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="System totals">
          {metricCards.map(({ key, label, icon: Icon }) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {overview.isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-semibold">{overview.data?.[key] ?? 0}</p>}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <h2 className="text-base font-semibold">Case-to-outreach flow</h2>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-muted-foreground">
                  <tr><th className="px-3 py-2">Stage</th><th className="px-3 py-2 text-right">Records</th></tr>
                </thead>
                <tbody>
                  {(["created", "matched", "outreach", "approved"] as const).map((stage) => (
                    <tr key={stage} className="border-t">
                      <td className="px-3 py-2 capitalize">{stage}</td>
                      <td className="px-3 py-2 text-right font-medium">{funnel.data?.[stage] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold">Stored resources</h2>
            <div className="divide-y rounded-md border">
              {(usage.data ?? []).map((item) => (
                <div key={item.metric} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="capitalize text-muted-foreground">{item.metric}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              {!usage.isLoading && (usage.data?.length ?? 0) === 0 && <p className="p-3 text-sm text-muted-foreground">No usage records available.</p>}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold">Users by case count</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr><th className="px-3 py-2">Account</th><th className="px-3 py-2 text-right">Cases</th></tr>
              </thead>
              <tbody>
                {(topUsers.data ?? []).map((item) => (
                  <tr key={item.userId} className="border-t">
                    <td className="px-3 py-2">{item.email || item.userId}</td>
                    <td className="px-3 py-2 text-right font-medium">{item.cases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}
