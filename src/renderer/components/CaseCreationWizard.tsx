/**
 * New case dialog — compact form (full multi-step wizard can be restored later).
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CaseData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  legalArea: string;
  summary: string;
  startDate?: Date;
  endDate?: Date;
  urgency: "Low" | "Medium" | "High";
}

interface CaseCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (caseData: CaseData) => void;
}

const LEGAL_AREAS = [
  "Arbeidsrecht (Employment Law)",
  "Huurrecht (Tenancy Law)",
  "Familierecht (Family Law)",
  "Strafrecht (Criminal Law)",
  "Verbintenissenrecht (Contract Law)",
  "Bestuursrecht (Administrative Law)",
  "Ondernemingsrecht (Corporate Law)",
  "Intellectueel eigendomsrecht (IP Law)",
  "Belastingrecht (Tax Law)",
  "Socialezekerheidsrecht (Social Security Law)",
  "Other",
];

export default function CaseCreationWizard({
  open,
  onOpenChange,
  onComplete,
}: CaseCreationWizardProps) {
  const [caseData, setCaseData] = useState<CaseData>({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    legalArea: "",
    summary: "",
    urgency: "Medium",
  });
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");

  useEffect(() => {
    if (!open) {
      setCaseData({
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        legalArea: "",
        summary: "",
        urgency: "Medium",
      });
      setStartStr("");
      setEndStr("");
    }
  }, [open]);

  const submit = () => {
    if (!caseData.clientName.trim() || !caseData.clientEmail.trim()) {
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(caseData.clientEmail)) {
      return;
    }
    if (!caseData.legalArea || !caseData.summary.trim()) {
      return;
    }
    const startDate = startStr ? new Date(startStr) : undefined;
    const endDate = endStr ? new Date(endStr) : undefined;
    onComplete?.({ ...caseData, startDate, endDate });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New case</DialogTitle>
          <DialogDescription>
            Add a matter so LARO can organise evidence and match lawyers.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ccw-name">Client name</Label>
            <Input
              id="ccw-name"
              value={caseData.clientName}
              onChange={(e) =>
                setCaseData((d) => ({ ...d, clientName: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ccw-email">Client email</Label>
            <Input
              id="ccw-email"
              type="email"
              value={caseData.clientEmail}
              onChange={(e) =>
                setCaseData((d) => ({ ...d, clientEmail: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ccw-phone">Phone (optional)</Label>
            <Input
              id="ccw-phone"
              value={caseData.clientPhone}
              onChange={(e) =>
                setCaseData((d) => ({ ...d, clientPhone: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Legal area</Label>
            <Select
              value={caseData.legalArea}
              onValueChange={(v) =>
                setCaseData((d) => ({ ...d, legalArea: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select area" />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Urgency</Label>
            <Select
              value={caseData.urgency}
              onValueChange={(v) =>
                setCaseData((d) => ({
                  ...d,
                  urgency: v as "Low" | "Medium" | "High",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ccw-summary">Case summary</Label>
            <Textarea
              id="ccw-summary"
              rows={4}
              value={caseData.summary}
              onChange={(e) =>
                setCaseData((d) => ({ ...d, summary: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ccw-start">Start (optional)</Label>
              <Input
                id="ccw-start"
                type="date"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ccw-end">End (optional)</Label>
              <Input
                id="ccw-end"
                type="date"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Create case</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
