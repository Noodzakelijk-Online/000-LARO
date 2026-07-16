import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Mail, Phone, Globe, MapPin, Users, GitCompare, ExternalLink, Database } from "lucide-react";
import { useState } from "react";
import LawyerComparisonView from "@/components/LawyerComparison";
import SmartSearchFilters from "@/components/SmartSearchFilters";
import { useLocation } from "wouter";

export default function Lawyers() {
  const { data, isLoading } = trpc.lawyers.list.useQuery();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLegalArea, setFilterLegalArea] = useState("");
  const [filterExperience, setFilterExperience] = useState("");
  const [filterAccepting, setFilterAccepting] = useState("");
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedLawyers, setSelectedLawyers] = useState<any[]>([]);

  const parseStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value !== "string") return [];
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      if (typeof parsed === "string" && parsed.trim()) return [parsed.trim()];
    } catch {
      // Fallback for legacy/non-JSON values like "Verzekeringsrecht"
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return [];
  };

  const toggleLawyerSelection = (lawyer: any) => {
    if (selectedLawyers.find(l => l.id === lawyer.id)) {
      setSelectedLawyers(selectedLawyers.filter(l => l.id !== lawyer.id));
    } else if (selectedLawyers.length < 3) {
      setSelectedLawyers([...selectedLawyers, lawyer]);
    }
  };

  const lawyers = data?.lawyers || [];
  const officialRecordCount = lawyers.filter((lawyer: any) => Boolean(lawyer.officialProfileUrl)).length;
  
  const filteredLawyers = lawyers.filter((lawyer: any) => {
    const areas = parseStringArray(lawyer.legalAreas);
    const normalizedQuery = searchQuery.trim().toLowerCase();
    // Search filter
    const matchesSearch = !normalizedQuery || [
      lawyer.name,
      lawyer.firm,
      lawyer.email,
      lawyer.phone,
      lawyer.website,
      lawyer.address,
      ...areas,
    ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
    
    // Legal area filter
    const matchesLegalArea = !filterLegalArea || (() => {
      return areas.some((area) => area.toLowerCase().includes(filterLegalArea.toLowerCase()));
    })();
    
    // Experience filter
    const matchesExperience = !filterExperience || (() => {
      const years = parseInt(lawyer.experienceYears || "0");
      if (filterExperience === "0-5") return years >= 0 && years <= 5;
      if (filterExperience === "6-10") return years >= 6 && years <= 10;
      if (filterExperience === "11-20") return years >= 11 && years <= 20;
      if (filterExperience === "20+") return years > 20;
      return true;
    })();
    
    // Accepting cases filter
    const matchesAccepting = !filterAccepting || 
      lawyer.currentlyAccepting === filterAccepting;
    
    return matchesSearch && matchesLegalArea && matchesExperience && matchesAccepting;
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            Lawyers Database
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Browse persisted lawyer profiles and records retrieved from the official NOvA public directory
          </p>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1">
              <SmartSearchFilters
                searchType="lawyers"
                onSearch={(query, filters) => {
                  setSearchQuery(query);
                  if (filters) {
                    setFilterLegalArea(filters.legalArea || "");
                    setFilterExperience(filters.experience || "");
                    setFilterAccepting(filters.accepting || "");
                  }
                }}
              />
            </div>
            <Button 
              variant={comparisonMode ? "default" : "outline"}
              className={comparisonMode ? "bg-purple-600 hover:bg-purple-700" : "border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/50"}
              onClick={() => {
                setComparisonMode(!comparisonMode);
                if (comparisonMode) setSelectedLawyers([]);
              }}
            >
              <GitCompare className="w-4 h-4 mr-2" />
              {comparisonMode ? `Compare (${selectedLawyers.length}/3)` : "Compare Mode"}
            </Button>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredLawyers.length} of {lawyers.length} lawyers
            {officialRecordCount > 0 && `; ${officialRecordCount} linked to an official NOvA profile`}
          </div>
        </div>

        {/* Comparison View */}
        {comparisonMode && selectedLawyers.length >= 2 && (
          <LawyerComparisonView lawyers={selectedLawyers} />
        )}

        {/* Lawyers Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-96 w-full bg-card/50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLawyers?.map((lawyer: any) => {
              const legalAreas = parseStringArray(lawyer.legalAreas);
              const languages = parseStringArray(lawyer.languages);
              
              return (
                <Card 
                  key={lawyer.id} 
                  className={`border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/10 group ${
                    comparisonMode && selectedLawyers.find(l => l.id === lawyer.id) 
                      ? 'ring-2 ring-purple-500' 
                      : ''
                  }`}
                  onClick={() => comparisonMode && toggleLawyerSelection(lawyer)}
                  style={{ cursor: comparisonMode ? 'pointer' : 'default' }}
                >
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
                        <span className="text-white font-semibold text-lg">
                          {lawyer.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{lawyer.name}</CardTitle>
                        {lawyer.experienceYears && Number(lawyer.experienceYears) > 0 && (
                          <p className="text-sm text-purple-400">
                            {lawyer.experienceYears} years experience
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Contact Info */}
                    <div className="space-y-2">
                      {lawyer.email && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-background/30">
                          <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="text-muted-foreground truncate text-xs">{lawyer.email}</span>
                        </div>
                      )}
                      {lawyer.phone && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-background/30">
                          <Phone className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-muted-foreground text-xs">{lawyer.phone}</span>
                        </div>
                      )}
                      {lawyer.address && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-background/30">
                          <MapPin className="w-4 h-4 text-purple-500 shrink-0" />
                          <span className="text-muted-foreground text-xs line-clamp-1">{lawyer.address}</span>
                        </div>
                      )}
                      {lawyer.website && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-background/30">
                          <Globe className="w-4 h-4 text-orange-500 shrink-0" />
                          <a 
                            href={lawyer.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate text-xs"
                          >
                            Website
                          </a>
                        </div>
                      )}
                      {lawyer.officialProfileUrl && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-background/30">
                          <Database className="w-4 h-4 text-emerald-500 shrink-0" />
                          <a
                            href={lawyer.officialProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-400 hover:underline truncate text-xs"
                          >
                            Official NOvA profile <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Legal Areas */}
                    <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Legal Areas
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {legalAreas.slice(0, 3).map((area: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                            {area}
                          </Badge>
                        ))}
                        {legalAreas.length > 3 && (
                          <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                            +{legalAreas.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Languages */}
                    <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Languages</p>
                      <div className="flex flex-wrap gap-1">
                        {languages.map((lang: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {comparisonMode ? (
                      <Button 
                        variant={selectedLawyers.find(l => l.id === lawyer.id) ? "default" : "outline"}
                        className={`w-full mt-4 transition-all ${
                          selectedLawyers.find(l => l.id === lawyer.id)
                            ? 'bg-purple-600 hover:bg-purple-700'
                            : 'border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/50'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLawyerSelection(lawyer);
                        }}
                        disabled={!selectedLawyers.find(l => l.id === lawyer.id) && selectedLawyers.length >= 3}
                      >
                        {selectedLawyers.find(l => l.id === lawyer.id) ? 'Selected' : 'Select to Compare'}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="w-full mt-4 border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all group-hover:border-purple-500/50"
                        onClick={() => setLocation(`/lawyers/${lawyer.id}`)}
                      >
                        View Profile
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {filteredLawyers && filteredLawyers.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-muted-foreground">No lawyers found matching your search.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

