import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { getElectronAPI } from "@/lib/electronApiShim";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Clock,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  AlertCircle,
  CircleHelp,
  BriefcaseBusiness,
  DoorOpen,
  MessageSquareText,
  Scale,
  Banknote
} from "lucide-react";

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  source: {
    evidenceId: string;
    title: string;
    citation: { quote: string; lineStart: number; lineEnd: number } | null;
  };
  importance: "critical" | "high" | "medium" | "low";
  category: "employment" | "termination" | "communication" | "legal" | "financial" | "other";
}

interface CaseTimelineProps {
  caseId: string;
}

export function CaseTimeline({ caseId }: CaseTimelineProps) {
  const [generating, setGenerating] = useState(false);
  const [timeline, setTimeline] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const generatedForCase = useRef<string | null>(null);

  const generateMutation = trpc.documentAnalysis.generateCaseTimeline.useMutation();
  const sourceMutation = trpc.evidenceFiles.getDownloadUrl.useMutation();

  const handleGenerateTimeline = async () => {
    try {
      setGenerating(true);
      setErrorMessage(null);
      const result = await generateMutation.mutateAsync({ caseId });
      setTimeline(result);
    } catch (error) {
      console.error('Error generating timeline:', error);
      setErrorMessage(error instanceof Error ? error.message : "Timeline generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const openSource = async (evidenceId: string) => {
    try {
      setErrorMessage(null);
      const source = await sourceMutation.mutateAsync({ id: evidenceId });
      if (!source.url) throw new Error(source.message || "The source file is not available.");
      await getElectronAPI().openExternal(source.url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The source file could not be opened.");
    }
  };

  useEffect(() => {
    if (generatedForCase.current === caseId) return;
    generatedForCase.current = caseId;
    void handleGenerateTimeline();
  }, [caseId]);

  const getImportanceColor = (importance: string) => {
    const colors = {
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300",
      low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300"
    };
    return colors[importance as keyof typeof colors] || colors.medium;
  };

  const getCategoryIconComponent = (category: string) => {
    const icons = {
      employment: BriefcaseBusiness,
      termination: DoorOpen,
      communication: MessageSquareText,
      legal: Scale,
      financial: Banknote,
      other: FileText
    };
    return icons[category as keyof typeof icons] || icons.other;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Timeline action failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {/* Generate Timeline Button */}
      {!timeline && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Case Timeline
            </CardTitle>
            <CardDescription>
              Generate a chronological timeline of events from your uploaded documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGenerateTimeline}
              disabled={generating}
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Timeline...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Generate Timeline
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Timeline Display */}
      {timeline && (
        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Events</div>
                  <div className="text-2xl font-bold">{timeline.events.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className="text-2xl font-bold">{timeline.duration_days} days</div>
                </div>
              </div>

              <div>
                <div className="font-medium mb-2">Summary</div>
                <p className="text-sm text-muted-foreground">{timeline.summary}</p>
              </div>

              {timeline.key_dates && timeline.key_dates.length > 0 && (
                <div>
                  <div className="font-medium mb-2">Key Dates</div>
                  <div className="flex flex-wrap gap-2">
                    {timeline.key_dates.map((date: string, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {formatDate(date)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Events */}
          <Card>
            <CardHeader>
              <CardTitle>Chronological Events</CardTitle>
              <CardDescription>
                {timeline.events.length} events sorted by date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                {/* Events */}
                <div className="space-y-6">
                  {timeline.events.map((event: TimelineEvent, idx: number) => {
                    const CategoryIcon = getCategoryIconComponent(event.category);
                    return (
                    <div key={idx} className="relative pl-12">
                      {/* Timeline Dot */}
                      <div className={`absolute left-2 w-4 h-4 rounded-full border-2 border-background ${
                        event.importance === 'critical' ? 'bg-red-500' :
                        event.importance === 'high' ? 'bg-orange-500' :
                        event.importance === 'medium' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`} />

                      {/* Event Card */}
                      <div className={`border rounded-lg p-4 ${getImportanceColor(event.importance)}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CategoryIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <h3 className="font-semibold">{event.title}</h3>
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              {formatDate(event.date)}
                            </div>
                            <p className="text-sm mb-2">{event.description}</p>
                            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate">{event.source.title}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    title="Open source document"
                                    aria-label={`Open source document ${event.source.title}`}
                                    onClick={() => openSource(event.source.evidenceId)}
                                  >
                                    <CircleHelp className="h-4 w-4" />
                                  </Button>
                                </div>
                                {event.source.citation?.quote && (
                                  <p className="mt-1 line-clamp-2">{event.source.citation.quote}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {event.importance}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Gaps */}
          {timeline.gaps && timeline.gaps.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Potential Gaps Identified</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {timeline.gaps.map((gap: string, idx: number) => (
                    <li key={idx} className="text-sm">{gap}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Regenerate Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={handleGenerateTimeline}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Regenerate Timeline
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

