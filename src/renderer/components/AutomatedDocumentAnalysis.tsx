import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Users,
  DollarSign,
  MapPin,
  AlertCircle
} from "lucide-react";

interface AutomatedDocumentAnalysisProps {
  caseId: number;
  onAnalysisComplete?: (documentId: number) => void;
}

export function AutomatedDocumentAnalysis({ caseId, onAnalysisComplete }: AutomatedDocumentAnalysisProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const uploadMutation = trpc.evidence.uploadDocument.useMutation();
  const analyzeMutation = trpc.documentAnalysis.analyzeDocument.useMutation();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAnalysisResult(null);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);

      // 1. Read file content
      const text = await selectedFile.text();

      // 2. Upload document
      const uploadResult = await uploadMutation.mutateAsync({
        caseId,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        content: text
      });

      setUploading(false);
      setAnalyzing(true);

      // 3. Analyze document automatically
      const analysis = await analyzeMutation.mutateAsync({
        documentId: Number(uploadResult.id),
        documentText: text,
        caseId
      });

      setAnalyzing(false);
      setAnalysisResult(analysis);

      if (onAnalysisComplete) {
        onAnalysisComplete(uploadResult.id);
      }

    } catch (error) {
      console.error('Error uploading/analyzing document:', error);
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const getRelevanceBadge = (relevance: string) => {
    const colors = {
      high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    };
    return colors[relevance as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document for Automated Analysis
          </CardTitle>
          <CardDescription>
            Upload any document and our AI will automatically classify it, extract key information, and validate its relevance to your case.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="flex-1"
              disabled={uploading || analyzing}
            />
            <Button
              onClick={handleUploadAndAnalyze}
              disabled={!selectedFile || uploading || analyzing}
            >
              {uploading || analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploading ? 'Uploading...' : 'Analyzing...'}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Analyze
                </>
              )}
            </Button>
          </div>

          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-4">
          {/* Document Classification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Classification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Document Type</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {analysisResult.detected_type.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">Confidence</div>
                  <div className="text-2xl font-bold text-primary">
                    {analysisResult.confidence}%
                  </div>
                </div>
              </div>

              <div>
                <div className="font-medium mb-1">Relevance to Case</div>
                <Badge className={getRelevanceBadge(analysisResult.relevance_to_case)}>
                  {analysisResult.relevance_to_case.toUpperCase()}
                </Badge>
              </div>

              <div>
                <div className="font-medium mb-2">Summary</div>
                <p className="text-sm text-muted-foreground">
                  {analysisResult.summary}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Extracted Information */}
          <Card>
            <CardHeader>
              <CardTitle>Extracted Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Parties */}
              {analysisResult.extracted_entities.parties.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 font-medium mb-2">
                    <Users className="h-4 w-4" />
                    Parties Involved
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.parties.map((party: string, idx: number) => (
                      <Badge key={idx} variant="outline">{party}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              {analysisResult.extracted_entities.dates.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 font-medium mb-2">
                    <Calendar className="h-4 w-4" />
                    Important Dates
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.dates.map((date: string, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {new Date(date).toLocaleDateString()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Amounts */}
              {analysisResult.extracted_entities.amounts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 font-medium mb-2">
                    <DollarSign className="h-4 w-4" />
                    Monetary Amounts
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.amounts.map((amount: number, idx: number) => (
                      <Badge key={idx} variant="outline">
                        €{amount.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Locations */}
              {analysisResult.extracted_entities.locations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 font-medium mb-2">
                    <MapPin className="h-4 w-4" />
                    Locations
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.locations.map((location: string, idx: number) => (
                      <Badge key={idx} variant="outline">{location}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Terms */}
              {analysisResult.extracted_entities.key_terms.length > 0 && (
                <div>
                  <div className="font-medium mb-2">Key Legal Terms</div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.extracted_entities.key_terms.map((term: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{term}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Red Flags */}
          {analysisResult.red_flags && analysisResult.red_flags.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Potential Issues Detected</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {analysisResult.red_flags.map((flag: string, idx: number) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {analysisResult.relevance_to_case === 'high' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Document Successfully Analyzed</AlertTitle>
              <AlertDescription>
                This document has been automatically classified and added to your case evidence.
                {analysisResult.matches_evidence_item && (
                  <span> It matches the required evidence item: <strong>{analysisResult.matches_evidence_item}</strong></span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

