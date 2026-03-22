import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  Filter,
  Save,
  Clock,
  X,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface SearchFilter {
  id: string;
  name: string;
  query: string;
  filters: {
    status?: string;
    urgency?: string;
    legalArea?: string;
    dateRange?: string;
  };
  savedAt: Date;
}

interface RecentSearch {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
}

const FILTER_PRESETS = [
  {
    id: "urgent-cases",
    name: "Urgent Cases",
    icon: TrendingUp,
    filters: { urgency: "high", status: "open" },
  },
  {
    id: "pending-response",
    name: "Pending Response",
    icon: Clock,
    filters: { status: "waiting_for_lawyer" },
  },
  {
    id: "this-week",
    name: "This Week",
    icon: Clock,
    filters: { dateRange: "week" },
  },
];

export default function SmartSearchFilters({ onSearch, searchType = "cases" }: { onSearch?: (query: string, filters: any) => void; searchType?: "cases" | "lawyers" | "evidence" }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [naturalLanguageMode, setNaturalLanguageMode] = useState(false);
  
  // Fetch saved searches from backend
  const { data: savedSearchesData = [], refetch: refetchSavedSearches } = trpc.savedSearches.list.useQuery({ searchType });
  
  // Create saved search mutation
  const createSavedSearchMutation = trpc.savedSearches.create.useMutation({
    onSuccess: () => {
      refetchSavedSearches();
      toast.success("Search filter saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save search: " + error.message);
    },
  });
  
  // Delete saved search mutation
  const deleteSavedSearchMutation = trpc.savedSearches.delete.useMutation({
    onSuccess: () => {
      refetchSavedSearches();
      toast.success("Search filter deleted");
    },
  });
  
  // Convert backend saved searches to frontend format
  const savedFilters: SearchFilter[] = savedSearchesData.map((search) => ({
    id: search.id,
    name: search.name,
    query: search.query || "",
    filters: search.filters,
    savedAt: search.createdAt || new Date(),
  }));
  
  const [currentFilters, setCurrentFilters] = useState<any>({});
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([
    {
      id: "1",
      query: "divorce lawyer Amsterdam",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      resultCount: 15,
    },
    {
      id: "2",
      query: "employment law urgent",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      resultCount: 8,
    },
  ]);

  const [activeFilters, setActiveFilters] = useState<{
    status?: string;
    urgency?: string;
    legalArea?: string;
    dateRange?: string;
  }>({});

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    // Add to recent searches
    const newSearch: RecentSearch = {
      id: Date.now().toString(),
      query: searchQuery,
      timestamp: new Date(),
      resultCount: Math.floor(Math.random() * 50), // Mock result count
    };
    setRecentSearches(prev => [newSearch, ...prev.slice(0, 9)]);

    // Trigger search callback
    onSearch?.(searchQuery, activeFilters);

    toast.success(`Searching for: ${searchQuery}`);
  };

  const handleSaveFilter = () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query first");
      return;
    }

    const filterName = prompt("Enter a name for this search filter:");
    if (!filterName) return;

    createSavedSearchMutation.mutate({
      name: filterName,
      query: searchQuery,
      filters: currentFilters,
      searchType,
    });
  };

  const handleLoadFilter = (filter: SearchFilter) => {
    setSearchQuery(filter.query);
    setCurrentFilters(filter.filters);
    toast.success(`Loaded filter: ${filter.name}`);
  };
  
  const handleDeleteFilter = (filterId: string) => {
    deleteSavedSearchMutation.mutate({ id: filterId });
  };

  const handleApplyPreset = (preset: typeof FILTER_PRESETS[0]) => {
    setActiveFilters(preset.filters);
    toast.success(`Applied preset: ${preset.name}`);
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    setSearchQuery("");
    toast.info("Filters cleared");
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={
                  naturalLanguageMode
                    ? "Try: 'Find urgent divorce cases in Amsterdam from this week'"
                    : "Search cases, lawyers, or documents..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 pr-10"
              />
              {naturalLanguageMode && (
                <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-pulse" />
              )}
            </div>

            <Button onClick={handleSearch}>Search</Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="relative">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 px-1.5 py-0 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2 text-white">Filters</h4>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-white">Status</label>
                    <Select
                      value={activeFilters.status || ""}
                      onValueChange={(value) =>
                        setActiveFilters(prev => ({ ...prev, status: value || undefined }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting_for_lawyer">Waiting for Lawyer</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-white">Urgency</label>
                    <Select
                      value={activeFilters.urgency || ""}
                      onValueChange={(value) =>
                        setActiveFilters(prev => ({ ...prev, urgency: value || undefined }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All urgencies" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-white">Legal Area</label>
                    <Select
                      value={activeFilters.legalArea || ""}
                      onValueChange={(value) =>
                        setActiveFilters(prev => ({ ...prev, legalArea: value || undefined }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All areas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="family">Family Law</SelectItem>
                        <SelectItem value="employment">Employment Law</SelectItem>
                        <SelectItem value="contract">Contract Law</SelectItem>
                        <SelectItem value="real-estate">Real Estate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-white">Date Range</label>
                    <Select
                      value={activeFilters.dateRange || ""}
                      onValueChange={(value) =>
                        setActiveFilters(prev => ({ ...prev, dateRange: value || undefined }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="year">This Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleClearFilters} className="flex-1">
                      Clear All
                    </Button>
                    <Button size="sm" onClick={handleSearch} className="flex-1">
                      Apply Filters
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* AI Mode Toggle */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant={naturalLanguageMode ? "default" : "outline"}
              size="sm"
              onClick={() => setNaturalLanguageMode(!naturalLanguageMode)}
            >
              <Sparkles className="w-3 h-3 mr-2" />
              Natural Language Search
            </Button>
            {naturalLanguageMode && (
              <span className="text-xs text-muted-foreground">
                Describe what you're looking for in plain language
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(activeFilters).map(([key, value]) =>
            value ? (
              <Badge key={key} variant="secondary" className="gap-1">
                {key}: {value}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive"
                  onClick={() => setActiveFilters(prev => ({ ...prev, [key]: undefined }))}
                />
              </Badge>
            ) : null
          )}
        </div>
      )}

      {/* Filter Presets */}
      <div>
        <h4 className="text-sm font-medium mb-2 text-white">Quick Filters</h4>
        <div className="flex flex-wrap gap-2">
          {FILTER_PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(preset)}
              >
                <Icon className="w-3 h-3 mr-2" />
                {preset.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-white">Saved Searches</h4>
              <Button variant="ghost" size="sm" onClick={handleSaveFilter}>
                <Save className="w-3 h-3 mr-2" />
                Save Current
              </Button>
            </div>
            <div className="space-y-2">
              {savedFilters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 cursor-pointer" onClick={() => handleLoadFilter(filter)}>
                    <p className="text-sm font-medium text-white">{filter.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {filter.query} • {Object.values(filter.filters).filter(Boolean).length} filters
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteFilter(filter.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3 text-white">Recent Searches</h4>
            <div className="space-y-2">
              {recentSearches.slice(0, 5).map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setSearchQuery(search.query)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-white">{search.query}</p>
                      <p className="text-xs text-muted-foreground">
                        {search.resultCount} results
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(search.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

