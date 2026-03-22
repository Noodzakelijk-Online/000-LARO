import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen, MessageSquare, Mail, ExternalLink, FileText, Video } from "lucide-react";

export default function Help() {
  const helpTopics = [
    {
      title: "Getting Started with LARO",
      description: "Learn how to create your first case and connect with lawyers",
      icon: BookOpen,
      link: "#",
    },
    {
      title: "Understanding the Matching Process",
      description: "How LARO finds and contacts qualified lawyers for your case",
      icon: FileText,
      link: "#",
    },
    {
      title: "Evidence Collection Guide",
      description: "Best practices for gathering and organizing legal evidence",
      icon: Video,
      link: "#",
    },
    {
      title: "Privacy & Data Security",
      description: "How we protect your sensitive legal information",
      icon: HelpCircle,
      link: "#",
    },
  ];

  const faqs = [
    {
      question: "How does LARO find lawyers for my case?",
      answer: "LARO uses AI to analyze your case details and match you with lawyers who specialize in your legal area, are located near you, and have the right expertise.",
    },
    {
      question: "How long does it take to get a response from lawyers?",
      answer: "Most lawyers respond within 24-48 hours. LARO sends automated follow-ups to ensure you get timely responses.",
    },
    {
      question: "Is my information secure?",
      answer: "Yes. All data is encrypted and stored securely. We comply with GDPR and Dutch data protection laws.",
    },
    {
      question: "Can I upload evidence from my email or cloud storage?",
      answer: "Yes! LARO can connect to Gmail, Google Drive, OneDrive, Slack, and other platforms to automatically collect relevant evidence.",
    },
    {
      question: "What if I need to clarify something about my case?",
      answer: "Use the chat widget (bottom right) to communicate with LARO. Our AI will ask clarifying questions to better understand your situation.",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            Help & Resources
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Everything you need to know about using LARO
          </p>
        </div>

        {/* Quick Help */}
        <Card className="border-border/50 bg-gradient-to-r from-orange-500/10 to-orange-600/10 backdrop-blur-sm border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-orange-500/20">
                <MessageSquare className="w-6 h-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Need Immediate Help?</h3>
                <p className="text-muted-foreground mb-4">
                  Use the chat widget in the bottom-right corner to ask LARO questions about your cases, evidence collection, or how the platform works.
                </p>
                <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Open Chat
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Topics */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Help Topics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {helpTopics.map((topic, index) => {
              const Icon = topic.icon;
              return (
                <Card 
                  key={index}
                  className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer"
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Icon className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{topic.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {topic.description}
                        </CardDescription>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* FAQs */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-500" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="p-4 rounded-lg border border-border/50 bg-background/50"
              >
                <h4 className="font-semibold text-foreground mb-2">{faq.question}</h4>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-green-500" />
              Still Need Help?
            </CardTitle>
            <CardDescription>
              Our support team is here to assist you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Email us at <span className="font-medium text-foreground">support@laro.nl</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  We typically respond within 24 hours
                </p>
              </div>
              <Button variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

