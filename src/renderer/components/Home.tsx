import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, UserCheck, FileText, MessageSquare, Activity } from "lucide-react";
import { StatCardSkeleton } from "@/components/SkeletonLoaders";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: recentMatches } = trpc.dashboard.interestedMatches.useQuery();
  const { data: pendingClarifications } = trpc.clarifications.pending.useQuery();

  const statCards = [
    {
      title: "Active Cases",
      value: stats?.activeCases || 0,
      description: "Total matters in progress",
      icon: Briefcase,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      action: () => setLocation("/cases")
    },
    {
      title: "Lawyer Connections",
      value: stats?.matchesMade || 0,
      description: "Professionals engaged",
      icon: UserCheck,
      iconBg: "bg-green-500/10",
      iconColor: "text-green-500"
    },
    {
      title: "Pending Actions",
      value: pendingClarifications?.length || 0,
      description: "Items needing your attention",
      icon: MessageSquare,
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-500"
    },
    {
      title: "Evidence Items",
      value: stats?.evidenceCollected || 0,
      description: "Total files collected",
      icon: FileText,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-500"
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-orange-500">
            Analytical Dashboard
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Platform-wide aggregated metrics and real-time insights
          </p>
        </div>

        {/* Analytics Section - Stats Cards */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Analytics & Stats</h2>
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card
                    key={index}
                    className={`border border-border bg-card shadow-sm transition-shadow hover:shadow-md ${stat.action ? "cursor-pointer" : ""}`}
                    onClick={stat.action}
                  >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{stat.value}</div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {stat.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Information + Actions split for clearer structure */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Real-time Information</h2>
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               {statsLoading ? (
                   <Skeleton className="h-24 w-full" />
               ) : (
                  <div className="space-y-3">
                    {recentMatches && recentMatches.length > 0 ? (
                      recentMatches.map((match: any) => (
                        <div key={match.id} className="p-3 bg-secondary/20 rounded-lg border border-border flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <UserCheck className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-foreground">New connection: {match.lawyerName} for Case {match.caseId}</span>
                           </div>
                           <span className="text-xs text-muted-foreground">
                              {match.lastContact ? new Date(match.lastContact).toLocaleDateString() : 'Recently'}
                           </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-4">No recent activity detected.</div>
                    )}
                  </div>
               )}
            </CardContent>
          </Card>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Pending Actions</h2>
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-orange-500" />
                Items Requiring Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(pendingClarifications?.length ?? 0) > 0 ? (
                pendingClarifications!.slice(0, 5).map((item: any, idx: number) => (
                  <div key={item.id ?? idx} className="p-3 bg-secondary/20 rounded-lg border border-border text-sm">
                    {item.question ?? item.title ?? "Action needed"}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No pending actions right now.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
