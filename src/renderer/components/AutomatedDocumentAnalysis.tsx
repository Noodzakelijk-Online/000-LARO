import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2, Calendar, Users, DollarSign, MapPin, Scale, Clock } from "lucide-react";

interface AutomatedDocumentAnalysisProps {
  caseId: string;
  onAnalysisComplete?: (documentId: string) => void;
}

type AnalysisView = {
  detected_type: string;
  confidence: number;
  relevance_to_case: "high" | "medium" | "low";
  summary: string;
  extracted_entities: {
    parties: string[];
    dates: string[];
    amounts: string[];
    locations: string[];
    key_terms: string[];
  };
  red_flags: string[];
  matches_evidence_item: string | null;
  provider_status: string;
  provider_message: string | null;
  extraction_method: string;
  extraction_confidence: number | null;
  citation_count: number;
  claims: string[];
  obligations: string[];
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32_768;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function AutomatedDocumentAnalysis({ caseId, onAnalysisComplete }: AutomatedDocumentAnalysisProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const capabilities = trpc.documentAnalysis.capabilities.useQuery();
  const uploadFile = trpc.evidenceFiles.upload.useMutation();
  const analyzeMutation = trpc.documentAnalysis.analyzeEvidence.useMutation();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAnalysisResult(null);
      setErrorMessage(null);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setErrorMessage(null);
      const base64 = arrayBufferToBase64(await selectedFile.arrayBuffer());
      const uploadResult = await uploadFile.mutateAsync({
        caseId,
        title: selectedFile.name,
        type: "document",
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        source: "manual",
        base64,
      });

      setUploading(false);
      setAnalyzing(true);

      const analysis = await analyzeMutation.mutateAsync({
        evidenceId: uploadResult.id,
        deepAnalysis: true,
      });
      const result = analysis.result;

      const parties = result.parties.map((item) => item.text).slice(0, 12);
      const keyTerms = result.legalIssues.map((item) => item.text).slice(0, 15);

      const view: AnalysisView = {
        detected_type: result.documentType,
        confidence: result.confidence,
        relevance_to_case: result.riskFlags.length > 0 || result.obligations.length > 2
          ? "high"
          : result.legalIssues.length === 0
            ? "low"
            : "medium",
        summary: result.summary,
        extracted_entities: {
          parties,
          dates: result.dates.map((item) => item.text),
          amounts: result.amounts.map((item) => item.text),
          locations: [],
          key_terms: keyTerms,
        },
        red_flags: result.riskFlags.map((item) => item.text),
        matches_evidence_item: selectedFile.name,
        provider_status: result.providerStatus,
        provider_message: result.providerMessage,
        extraction_method: result.extractionMethod,
        extraction_confidence: result.extractionConfidence,
        citation_count: result.citations.length,
        claims: result.claims.map((item) => item.text),
        obligations: result.obligations.map((item) => item.text),
      };

      setAnalyzing(false);
      setAnalysisResult(view);
      onAnalysisComplete?.(uploadResult.id);
    } catch (error) {
      console.error("Error uploading/analyzing document:", error);
      setErrorMessage(error instanceof Error ? error.message : "Document analysis failed.");
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const getRelevanceBadge = (relevance: string) => {
    const colors = {
      high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };
    return colors[relevance as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload document for automated analysis
          </CardTitle>
          <CardDescription>
            Files are stored as evidence on this case; text is analyzed with LARO&apos;s document model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              accept=".pdf,.docx,.txt,.csv,.html,.eml,.jpg,.jpeg,.png,.gif,.webp,.bmp"
              onChange={handleFileSelect}
              className="min-w-0 flex-1 text-sm"
              disabled={uploading || analyzing}
            />
            <Button onClick={handleUploadAndAnalyze} disabled={!selectedFile || uploading || analyzing}>
              {uploading || analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploading ? "Uploading…" : "Analyzing…"}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload &amp; analyze
                </>
              )}
            </Button>
          </div>
          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Local source extraction is always used, including Dutch and English OCR for images. Deep analysis is {capabilities.data?.deepAnalysisConfigured ? "configured" : "not configured"}; findings remain linked to extracted source passages.
          </p>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Analysis could not complete</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {analysisResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document classification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Document type</div>
                  <div className="text-sm capitalize text-muted-foreground">
                    {analysisResult.detected_type.replace(/_/g, " ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">Confidence</div>
                  <div className="text-2xl font-bold text-primary">{analysisResult.confidence}%</div>
                </div>
              </div>
              <div>
                <div className="mb-1 font-medium">Relevance to case</div>
                <Badge className={getRelevanceBadge(analysisResult.relevance_to_case)}>
                  {analysisResult.relevance_to_case.toUpperCase()}
                </Badge>
              </div>
              <div>
                <div className="mb-2 font-medium">Summary</div>
                <p className="text-sm text-muted-foreground">{analysisResult.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{analysisResult.citation_count} source passages</Badge>
                <Badge variant="outline">{analysisResult.extraction_method.replace(/_/g, " ")}</Badge>
                {analysisResult.extraction_confidence !== null ? (
                  <Badge variant="outline">OCR {analysisResult.extraction_confidence.toFixed(0)}%</Badge>
                ) : null}
                <Badge variant="outline">{analysisResult.provider_status.replace(/_/g, " ")}</Badge>
              </div>
              {analysisResult.provider_message && (
                <p className="text-xs text-muted-foreground">{analysisResult.provider_message}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extracted information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysisResult.extracted_entities.parties.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4" />
                    Entities
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.parties.map((party: string, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {party}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {analysisResult.extracted_entities.dates.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4" />
                    Important dates
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.dates.map((date: string, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {date}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {analysisResult.extracted_entities.amounts.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <DollarSign className="h-4 w-4" />
                    Amounts
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.amounts.map((amount: string, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {amount}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {analysisResult.extracted_entities.locations.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4" />
                    Locations
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.locations.map((location: string, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {location}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {analysisResult.extracted_entities.key_terms.length > 0 && (
                <div>
                  <div className="mb-2 font-medium">Key terms</div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.key_terms.map((term: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {(analysisResult.claims.length > 0 || analysisResult.obligations.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Legal reading</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Scale className="h-4 w-4" /> Claims and positions
                  </div>
                  {analysisResult.claims.length ? (
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {analysisResult.claims.map((claim, index) => <li key={index}>{claim}</li>)}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No explicit claims detected.</p>}
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4" /> Obligations and deadlines
                  </div>
                  {analysisResult.obligations.length ? (
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {analysisResult.obligations.map((obligation, index) => <li key={index}>{obligation}</li>)}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No explicit obligations detected.</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {analysisResult.red_flags && analysisResult.red_flags.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Potential issues</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {analysisResult.red_flags.map((flag: string, idx: number) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {analysisResult.relevance_to_case === "high" && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Analysis complete</AlertTitle>
              <AlertDescription>
                Document stored on the case and summarized for your review.
                {analysisResult.matches_evidence_item && (
                  <span>
                    {" "}
                    Matches evidence item: <strong>{analysisResult.matches_evidence_item}</strong>
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
