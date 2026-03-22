import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Target, Clock, UserCheck, FileText, MessageSquare, CheckCircle, AlertCircle, TrendingUp, Plus } from "lucide-react";
import { useState } from "react";
import CaseCreationWizard from "@/components/CaseCreationWizard";
import { StatCardSkeleton } from "@/components/SkeletonLoaders";
import { useLocation } from "wouter";
import { CriticalGapsAlert } from "@/components/CriticalGapsAlert";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [showNewCaseDialog, setShowNewCaseDialog] = useState(false);
  const createCase = trpc.cases.create.useMutation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: recentCases } = trpc.dashboard.recentCases.useQuery();
  const { data: recentMatches } = trpc.dashboard.interestedMatches.useQuery();
  const { data: pendingClarifications } = trpc.clarifications.pending.useQuery();

  const activeCasesCount = stats?.activeCases ?? 0;
  const showNewUserActivity =
    !statsLoading && activeCasesCount === 0;

  // Citizen-relevant metrics (not admin stats)
  const statCards = [
    {
      title: "Your Active Cases",
      value: stats?.activeCases || 0,
      description: "Legal matters we're helping with",
      icon: Briefcase,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      action: () => setLocation("/cases")
    },
    {
      title: "Lawyers Contacted",
      value: stats?.matchesMade || 0,
      description: "Professionals we've reached out to",
      icon: UserCheck,
      iconBg: "bg-green-500/10",
      iconColor: "text-green-500"
    },
    {
      title: "Pending Actions",
      value: pendingClarifications?.length || 0,
      description: "Questions waiting for your input",
      icon: MessageSquare,
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-500"
    },
    {
      title: "Evidence Collected",
      value: stats?.evidenceCollected || 0,
      description: "Documents and files gathered",
      icon: FileText,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-500"
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with CTA — matches https://lawyerdashboard.manus.space/ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-orange-500">
              Your Legal Dashboard
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Track your cases and connect with qualified lawyers
            </p>
          </div>
          <Button
            onClick={() => setShowNewCaseDialog(true)}
            size="lg"
            className="shrink-0 bg-orange-500 font-semibold text-white shadow-sm hover:bg-orange-600"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Case
          </Button>
        </div>

        {/* Critical Gaps Alert */}
        {user && <CriticalGapsAlert userId={user.id} />}

        {/* Personal Progress Stats */}
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
                className="cursor-pointer border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
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

        {/* What's Happening Now - Real-time LARO Activity */}
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              What&apos;s Happening Now
            </CardTitle>
            <CardDescription>Real-time updates on your cases</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statsLoading ? (
              <div className="space-y-3 py-6">
                <Skeleton className="mx-auto h-12 w-12 rounded-full" />
                <Skeleton className="mx-auto h-4 w-64 max-w-full" />
                <Skeleton className="mx-auto h-9 w-48" />
              </div>
            ) : showNewUserActivity ? (
              <div className="py-8 text-center">
                <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="mb-4 text-muted-foreground">
                  You haven&apos;t created any cases yet
                </p>
                <Button
                  onClick={() => setShowNewCaseDialog(true)}
                  className="bg-orange-500 font-medium text-white hover:bg-orange-600"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Case
                </Button>
              </div>
            ) : (
              <>
                {recentMatches && recentMatches.length > 0 && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-green-400">
                          {recentMatches.length} lawyer{recentMatches.length > 1 ? 's' : ''} interested in your cases
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          We've found qualified professionals who can help
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {stats?.activeCases > 0 && (
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Target className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-blue-400">
                          LARO is actively matching lawyers to your cases
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          We're analyzing {stats.activeCases} case{stats.activeCases > 1 ? 's' : ''} and contacting qualified professionals
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Cases & Lawyer Matches */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Your Recent Cases */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-orange-500" />
                Your Recent Cases
              </CardTitle>
              <CardDescription>Your latest legal matters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!recentCases || recentCases.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">No cases yet</p>
                </div>
              ) : (
                recentCases.map((caseItem: any) => (
                  <div
                    key={caseItem.id}
                    className="p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:border-orange-500/50 cursor-pointer"
                    onClick={() => setLocation("/cases")}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-foreground">{caseItem.clientName}</h4>
                        <Badge
                          variant={
                            caseItem.urgency === "High" ? "destructive" :
                            caseItem.urgency === "Medium" ? "default" :
                            "secondary"
                          }
                          className="mt-1"
                        >
                          {caseItem.urgency}
                        </Badge>
                      </div>
                      <Badge variant={
                        caseItem.status === "Matched" ? "default" :
                        caseItem.status === "Outreach" ? "secondary" :
                        "outline"
                      }>
                        {caseItem.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{caseItem.caseType}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{caseItem.caseSummary}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(caseItem.createdAt!).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Lawyers Interested */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                Lawyers Interested in Your Cases
              </CardTitle>
              <CardDescription>Professionals we've contacted for you</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {!recentMatches || recentMatches.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">No matches yet</p>
                    <p className="text-muted-foreground text-xs mt-2">Create a case to get started</p>
                  </div>
                ) : (
                  recentMatches.map((match: any) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 hover:border-green-500/50 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                          <UserCheck className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{match.lawyerName || 'Unknown Lawyer'}</div>
                          <div className="text-sm text-muted-foreground">
                            {match.caseName || match.caseId} • {match.caseType || 'Case'}
                            {match.distanceKm && ` • ${parseFloat(match.distanceKm).toFixed(1)} km away`}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                            {match.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {match.lastContact ? new Date(match.lastContact).toLocaleDateString('nl-NL') : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Next Steps - Actionable Items */}
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              Next Steps
            </CardTitle>
            <CardDescription>What you should do next</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statsLoading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : showNewUserActivity ? (
              <div className="rounded-lg border border-orange-500/25 bg-orange-500/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
                    <Plus className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-orange-600 dark:text-orange-400">
                      Create your first case
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tell us about your legal issue and we&apos;ll connect you with qualified
                      lawyers
                    </p>
                    <Button
                      onClick={() => setShowNewCaseDialog(true)}
                      size="sm"
                      className="mt-3 bg-orange-500 text-white hover:bg-orange-600"
                    >
                      Get Started
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                    <CheckCircle className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-blue-600 dark:text-blue-400">
                      We&apos;re working on your cases
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      LARO is actively matching lawyers and sending outreach emails. We&apos;ll
                      notify you when lawyers respond.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CaseCreationWizard 
        open={showNewCaseDialog} 
        onOpenChange={setShowNewCaseDialog}
        onComplete={(caseData) => {
          createCase.mutate({
            caseType: caseData.legalArea,
            caseSummary: caseData.summary,
            urgency: caseData.urgency.charAt(0).toUpperCase() + caseData.urgency.slice(1) as "Low" | "Medium" | "High",
            clientName: caseData.clientName,
            clientEmail: caseData.clientEmail,
            clientPhone: caseData.clientPhone,
          }, {
            onSuccess: () => {
              toast.success("Case created successfully! We're now matching you with qualified lawyers.");
              setShowNewCaseDialog(false);
            },
            onError: (error) => {
              toast.error(`Failed to create case: ${error.message}`);
            },
          });
        }}
      />
    </DashboardLayout>
  );
}

