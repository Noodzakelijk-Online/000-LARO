import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import CaseCreationWizard from "@/components/CaseCreationWizard";
import EnhancedCaseDetailsDialog from "@/components/EnhancedCaseDetailsDialog";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MapPin, Clock, Briefcase, FileText, Upload } from "lucide-react";
import SmartSearchFilters from "@/components/SmartSearchFilters";
import { BulkCaseImport } from "@/components/BulkCaseImport";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Cases() {
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const createCase = trpc.cases.create.useMutation();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  
  const { data, isLoading } = trpc.cases.list.useQuery({ page, limit: 20 });
  const allCases = data?.cases ?? [];
  const pagination = data?.pagination;
  
  // Client-side filtering
  const cases = allCases.filter(c => {
    const matchesSearch = !searchTerm || 
      c.caseType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.caseSummary?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || c.status === statusFilter;
    const matchesUrgency = !urgencyFilter || c.urgency === urgencyFilter;
    return matchesSearch && matchesStatus && matchesUrgency;
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Top controls: title + actions + search/filter */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Your Cases
              </h1>
              <p className="text-muted-foreground mt-2">
                Track your legal matters and lawyer connections
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setBulkImportOpen(true)}
                variant="outline"
                className="border-orange-500/30 hover:bg-orange-500/10"
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
              <Button
                onClick={() => setNewCaseOpen(true)}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Case
              </Button>
            </div>
          </div>

          <div>
            <SmartSearchFilters
              compact
              onSearch={(query, filters) => {
                setSearchTerm(query);
                if (filters) {
                  setStatusFilter(filters.status || null);
                  setUrgencyFilter(filters.urgency || null);
                }
              }}
            />
          </div>
        </div>

        {/* Cases Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-80 w-full bg-card/50" />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-orange-500/10 mb-4">
                <FileText className="w-12 h-12 text-orange-500" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">You haven't created any cases yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Tell us about your legal issue and we'll connect you with qualified lawyers who can help.
              </p>
              <p className="text-sm text-muted-foreground">
                Use the single <span className="font-medium text-foreground">New Case</span> action in the page header to create your case.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {cases?.map((caseItem: any) => {
                let legalAreas: string[] = [];
                if (caseItem.legalAreas) {
                  try {
                    legalAreas = typeof caseItem.legalAreas === 'string' 
                      ? JSON.parse(caseItem.legalAreas) 
                      : Array.isArray(caseItem.legalAreas) 
                        ? caseItem.legalAreas 
                        : [];
                  } catch (error) {
                    console.warn('[Cases] Failed to parse legalAreas:', error);
                    // If it's already a string (not JSON), treat it as a single area
                    legalAreas = typeof caseItem.legalAreas === 'string' 
                      ? [caseItem.legalAreas] 
                      : [];
                  }
                }
                
                return (
                  <Card 
                    key={caseItem.id} 
                    className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-orange-500/10 group"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                              <Briefcase className="w-4 h-4 text-blue-500" />
                            </div>
                            <CardTitle className="text-lg">Your {caseItem.caseType} Case</CardTitle>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {caseItem.caseType}
                          </p>
                        </div>
                        <Badge variant={
                          caseItem.status === "Matched" ? "default" :
                          caseItem.status === "Outreach" ? "secondary" :
                          "outline"
                        } className={
                          caseItem.status === "Matched" ? "bg-green-500 hover:bg-green-600" :
                          caseItem.status === "Outreach" ? "bg-blue-500 hover:bg-blue-600" :
                          ""
                        }>
                          {caseItem.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {caseItem.caseSummary}
                      </p>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{caseItem.clientAddress || "No address provided"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>Created {new Date(caseItem.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {legalAreas.map((area: any, index: number) => (
                          <Badge key={index} variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                            {typeof area === 'string' ? area : area.area || area.areaEn || 'Unknown'}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <Badge variant="outline" className={
                          caseItem.urgency === "High" ? "border-red-500/50 text-red-400" :
                          caseItem.urgency === "Medium" ? "border-yellow-500/50 text-yellow-400" :
                          "border-green-500/50 text-green-400"
                        }>
                          {caseItem.urgency} Priority
                        </Badge>
                      </div>

                    <Button
                      variant="outline"
                      onClick={() => setSelectedCaseId(caseItem.id)}
                      className="w-full mt-4 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all group-hover:border-blue-500/50"
                    >
                      View Your Case Details
                    </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-purple-500/30 hover:bg-purple-500/10"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, i) => i + 1).map((pageNum) => (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      onClick={() => setPage(pageNum)}
                      className={page === pageNum 
                        ? "bg-gradient-to-r from-purple-500 to-pink-500" 
                        : "border-purple-500/30 hover:bg-purple-500/10"
                      }
                    >
                      {pageNum}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="border-purple-500/30 hover:bg-purple-500/10"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      
      <CaseCreationWizard 
        open={newCaseOpen} 
        onOpenChange={setNewCaseOpen}
        onComplete={(caseData) => {
          const u = caseData.urgency;
          const urgency =
            u === "low" ? "Low" : u === "high" ? "High" : "Medium";
          createCase.mutate({
            caseType: caseData.legalArea,
            caseSummary: caseData.summary,
            urgency,
            clientName: caseData.clientName,
            clientEmail: caseData.clientEmail,
          });
        }}
      />
      {selectedCaseId && (
        <EnhancedCaseDetailsDialog
          caseId={selectedCaseId}
          open={!!selectedCaseId}
          onOpenChange={(open) => !open && setSelectedCaseId(null)}
        />
      )}
      
      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Case Import</DialogTitle>
          </DialogHeader>
          <BulkCaseImport />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
