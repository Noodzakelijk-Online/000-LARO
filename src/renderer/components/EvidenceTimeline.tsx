            </Select>
          </div>

          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-muted-foreground">
              {evidence && Array.isArray(evidence) ? evidence.length : 0} items found
            </p>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Timeline
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading timeline...</p>
          </CardContent>
        </Card>
      ) : !groupedEvidence || Object.keys(groupedEvidence).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No evidence found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start collecting evidence by syncing your email or uploading files
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvidence)
            .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
            .map(([date, items]) => (
              <div key={date} className="relative">
                {/* Date Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">{format(new Date(date), "MMMM dd, yyyy")}</span>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary">{items.length} items</Badge>
                </div>

                {/* Evidence Items */}
                <div className="ml-8 space-y-4">
                  {items.map((item) => (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className="mt-1">
                            {getTypeIcon(item.type)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="font-medium truncate">{item.title}</h3>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getSourceColor(item.source || "")}>
                                  {item.source}
                                </Badge>
                                <Badge variant="outline">{item.type}</Badge>
                              </div>
                            </div>

                            {/* Metadata */}
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <span>{format(new Date(item.createdAt), "HH:mm")}</span>
                              {item.fileSize && (
                                <span>{(parseInt(item.fileSize) / 1024 / 1024).toFixed(2)} MB</span>
                              )}
                              {item.tags && JSON.parse(item.tags).length > 0 && (
                                <div className="flex gap-1">
                                  {JSON.parse(item.tags).slice(0, 3).map((tag: string, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <Button variant="ghost" size="sm">
                            View
                          </Button>