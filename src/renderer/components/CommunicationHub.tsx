import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Mail,
  Send,
  Clock,
  FileText,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  caseId?: string;
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatRelativeTime(date: Date) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1_000);
  const absoluteSeconds = Math.abs(seconds);
  if (absoluteSeconds < 60) return relativeTime.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  return relativeTime.format(Math.round(hours / 24), "day");
}

export default function CommunicationHub({ caseId }: { caseId?: string }) {
  // Fetch messages from backend (filtered by case if caseId provided)
  const { data: messagesData = [], refetch: refetchMessages } = trpc.messages.list.useQuery(
    caseId ? { caseId } : undefined
  );
  
  // Fetch message templates from backend
  const { data: templatesData = [] } = trpc.messageTemplates.list.useQuery();
  
  // Send message mutation
  const sendMessageMutation = trpc.messages.send.useMutation({
    onSuccess: () => {
      refetchMessages();
      toast.success("Note saved locally. No email was sent.");
      setMessageContent("");
    },
    onError: (error) => {
      toast.error("Failed to send message: " + error.message);
    },
  });
  
  // Convert backend messages to frontend format
  const messages: Message[] = messagesData.map((msg) => ({
    id: msg.id,
    content: msg.content || "",
    timestamp: msg.createdAt || new Date(),
    caseId: msg.caseId || undefined,
  }));

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [messageContent, setMessageContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const messageTemplates = templatesData.map((template) => ({
    id: template.id,
    title: template.name || "Template",
    content: template.body || "",
  }));

  const handleTemplateSelect = (templateId: string) => {
    const template = messageTemplates.find(t => t.id === templateId);
    if (template) {
      setMessageContent(template.content);
      setSelectedTemplate(templateId);
      toast.success(`Template "${template.title}" loaded`);
    }
  };

  const handleSendMessage = () => {
    if (!messageContent.trim()) {
      toast.error("Please enter a message");
      return;
    }

    sendMessageMutation.mutate({
      body: messageContent,
      caseId,
    });
    
    setSelectedTemplate("");
  };

  const filteredMessages = messages.filter(msg => {
    const query = searchQuery.toLowerCase();
    return msg.content.toLowerCase().includes(query) || msg.caseId?.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-md border border-border/60 bg-card/30 p-4">
        <FileText className="h-5 w-5 text-orange-500" />
        <div>
          <p className="text-sm font-medium">{messages.length} saved case note{messages.length === 1 ? "" : "s"}</p>
          <p className="text-xs text-muted-foreground">Notes stay inside LARO and are not sent as email.</p>
        </div>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inbox">
            <Mail className="w-4 h-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="compose">
            <Send className="w-4 h-4 mr-2" />
            New note
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    aria-label="Search case notes"
                    placeholder="Search saved notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
              </div>
            </CardContent>
          </Card>

          {/* Messages List */}
          <div className="space-y-3">
            {filteredMessages.map((message) => (
              <Card key={message.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium">Case note</h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(message.timestamp)}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {message.content}
                      </p>

                      {message.caseId && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          {message.caseId}
                        </Badge>
                      )}

                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredMessages.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No case notes found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="compose" className="space-y-4">
          {messageTemplates.length > 0 && <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Note Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {messageTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplate === template.id ? "default" : "outline"}
                    className="justify-start h-auto py-3"
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <div className="text-left">
                      <p className="font-medium">{template.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click to use this template
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>}

          {/* Compose Form */}
          <Card>
            <CardHeader>
              <CardTitle>New Case Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Note</label>
                <Textarea
                  aria-label="Case note message"
                  placeholder="Add context, a decision, or a follow-up..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={10}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMessageContent("");
                    setSelectedTemplate("");
                  }}
                >
                  Clear
                </Button>
                <Button onClick={handleSendMessage}>
                  <Send className="w-4 h-4 mr-2" />
                  Save Note
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

