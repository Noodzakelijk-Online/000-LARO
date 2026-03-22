import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Milestone {
  id: string;
  title: string;
  description: string;
  status: "completed" | "current" | "upcoming" | "blocked";
  completedAt?: Date;
  dueDate?: Date;
}

interface NextAction {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueDate?: Date;
}

interface CaseProgress {
  caseId: string;
  caseTitle: string;
  overallProgress: number;
  healthScore: number;
  milestones: Milestone[];
  nextActions: NextAction[];
  deadlines: {
    id: string;
    title: string;
    dueDate: Date;
    priority: "high" | "medium" | "low";
  }[];
  recentActivity: {
    id: string;
    type: string;
    description: string;
    timestamp: Date;
  }[];
}

export default function ProgressTrackingDashboard({ caseProgress }: { caseProgress: CaseProgress }) {
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getHealthScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Attention";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getMilestoneIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case "current":
        return <Circle className="w-5 h-5 text-primary fill-primary" />;
      case "blocked":
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const completedMilestones = caseProgress.milestones.filter(m => m.status === "completed").length;
  const totalMilestones = caseProgress.milestones.length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Progress */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Overall Progress</p>
                <p className="text-3xl font-bold">{caseProgress.overallProgress}%</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
            <Progress value={caseProgress.overallProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedMilestones} of {totalMilestones} milestones completed
            </p>
          </CardContent>
        </Card>

        {/* Case Health Score */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Case Health</p>
                <p className={`text-3xl font-bold ${getHealthScoreColor(caseProgress.healthScore)}`}>
                  {caseProgress.healthScore}
                </p>
              </div>
              <Badge variant="outline" className="text-sm">
                {getHealthScoreLabel(caseProgress.healthScore)}
              </Badge>
            </div>
            <Progress value={caseProgress.healthScore} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Based on progress, deadlines, and activity
            </p>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Upcoming Deadlines</p>
                <p className="text-3xl font-bold">{caseProgress.deadlines.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-600 dark:text-amber-500" />
              </div>
            </div>
            {caseProgress.deadlines.length > 0 && (
              <div className="space-y-1">
                {caseProgress.deadlines.slice(0, 2).map((deadline) => (
                  <div key={deadline.id} className="flex items-center justify-between text-xs">
                    <span className="truncate">{deadline.title}</span>
                    <Badge variant={getPriorityColor(deadline.priority)} className="text-xs">
                      {formatDistanceToNow(deadline.dueDate, { addSuffix: true })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Milestones Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Case Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {caseProgress.milestones.map((milestone, index) => (
              <div key={milestone.id} className="flex gap-4">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  {getMilestoneIcon(milestone.status)}
                  {index < caseProgress.milestones.length - 1 && (
                    <div className="w-0.5 h-full bg-border my-1 flex-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div>
                      <h4 className="font-medium">{milestone.title}</h4>
                      <p className="text-sm text-muted-foreground">{milestone.description}</p>
                    </div>
                    <Badge
                      variant={
                        milestone.status === "completed"
                          ? "default"
                          : milestone.status === "blocked"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {milestone.status}
                    </Badge>
                  </div>

                  {milestone.completedAt && (
                    <p className="text-xs text-muted-foreground">
                      Completed {formatDistanceToNow(milestone.completedAt, { addSuffix: true })}
                    </p>
                  )}

                  {milestone.dueDate && milestone.status !== "completed" && (
                    <p className="text-xs text-muted-foreground">
                      Due {formatDistanceToNow(milestone.dueDate, { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            Recommended Next Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {caseProgress.nextActions.map((action) => (
              <div
                key={action.id}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-medium">{action.title}</h4>
                    <Badge variant={getPriorityColor(action.priority)}>{action.priority}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
                  {action.dueDate && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Due {formatDistanceToNow(action.dueDate, { addSuffix: true })}
                    </div>
                  )}
                </div>
                <Button size="sm">Take Action</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {caseProgress.recentActivity.map((activity) => (
              <div key={activity.id} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.type}</p>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

