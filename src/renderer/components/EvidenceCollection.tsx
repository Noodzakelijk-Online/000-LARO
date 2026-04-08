import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, File, Image, Video, Music, MessageSquare, FileText, Download, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import BulkEvidenceUpload from "@/components/BulkEvidenceUpload";

interface EvidenceCollectionProps {
  caseId: string;
  onEvidenceUpdated?: () => void;
}

export function EvidenceCollection({ caseId, onEvidenceUpdated }: EvidenceCollectionProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    type: "document" as const,
    title: "",
    description: "",
    source: "Manual Upload",
    tags: [] as string[],
  });

  const { data: evidenceList, refetch } = trpc.evidence.list.useQuery({ caseId });
  const uploadMutation = trpc.evidence.upload.useMutation();
  const deleteMutation = trpc.evidence.delete.useMutation();
  const utils = trpc.useUtils();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.title) {
        setFormData(prev => ({ ...prev, title: file.name }));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    if (!formData.title) {
      toast.error("Please enter a title");
      return;
    }

    setUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64 = base64Data.split(",")[1]; // Remove data:image/png;base64, prefix

        await uploadMutation.mutateAsync({
          caseId,
          type: formData.type,
          title: formData.title,
          description: formData.description,
          source: formData.source,
          tags: formData.tags,
          fileData: base64,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
        });

        toast.success("Evidence uploaded successfully");
        setUploadOpen(false);
        setSelectedFile(null);
        setFormData({
          type: "document",
          title: "",
          description: "",
          source: "Manual Upload",
          tags: [],
        });
        utils.evidence.list.invalidate({ caseId });
        onEvidenceUpdated?.();
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      toast.error("Failed to upload evidence");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this evidence?")) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Evidence deleted");
      utils.evidence.list.invalidate({ caseId });
      onEvidenceUpdated?.();
    } catch (error) {
      toast.error("Failed to delete evidence");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "photo": return <Image className="w-5 h-5" />;
      case "video": return <Video className="w-5 h-5" />;
      case "audio": return <Music className="w-5 h-5" />;
      case "chat": return <MessageSquare className="w-5 h-5" />;
      case "email": return <FileText className="w-5 h-5" />;
      default: return <File className="w-5 h-5" />;
    }
  };

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    if (!selectedFile || uploading) return;
    if (!formData.title) return;
    handleUpload();
    // Intentionally trigger upload as soon as a file is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, formData.title]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Evidence Collection</h2>
          <p className="text-muted-foreground">Upload and manage case evidence</p>
        </div>
        <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Bulk Upload
        </Button>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Upload Evidence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Evidence</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>File</Label>
                <Input
                  type="file"
                  onChange={handleFileSelect}
                  className="mt-2"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size.toString())})
                  </p>
                )}
              </div>

              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="chat">Chat/Message</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Contract Agreement 2024"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add any relevant details about this evidence..."
                  className="mt-2"
                  rows={3}
                />
              </div>

              <div>
                <Label>Source (Optional)</Label>
                <Input
                  value={formData.source}
                  onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                  placeholder="e.g., Gmail, WhatsApp, Manual Upload"
                  className="mt-2"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <div className="flex-1 text-sm text-muted-foreground flex items-center">
                  {uploading
                    ? "Uploading automatically..."
                    : "Files upload automatically after selection."}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setUploadOpen(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Evidence List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {evidenceList?.length === 0 ? (
          <Card className="col-span-full border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-orange-500/10 mb-4">
                <Upload className="w-12 h-12 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No evidence uploaded yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Upload documents, emails, photos, and other evidence to support your case.
              </p>
            </CardContent>
          </Card>
        ) : (
          evidenceList?.map((item) => (
            <Card key={item.id} className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 hover:shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                      {getIcon(item.type)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {item.type}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.source}</span>
                  {item.fileSize && <span>{formatFileSize(item.fileSize)}</span>}
                </div>
                <div className="flex gap-2">
                  {item.fileUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(item.fileUrl!, "_blank")}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <BulkEvidenceUpload
        caseId={caseId}
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onComplete={() => {
          setBulkUploadOpen(false);
          utils.evidence.list.invalidate({ caseId });
          onEvidenceUpdated?.();
        }}
      />
    </div>
  );
}

