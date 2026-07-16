/**
 * New case dialog — compact form (full multi-step wizard can be restored later).
 */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
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
  urgency: "Medium";
  profileSource: "account" | "custom";
  uploadDocumentsAfterCreate: boolean;
}

interface CaseCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (caseData: CaseData) => boolean | void | Promise<boolean | void>;
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

function defaultCaseData(user: { name?: string | null; email?: string | null } | null | undefined): CaseData {
  return {
    clientName: user?.name || "",
    clientEmail: user?.email || "",
    clientPhone: "",
    legalArea: "",
    summary: "",
    urgency: "Medium",
    profileSource: "account",
    uploadDocumentsAfterCreate: false,
  };
}

export function normalizeCaseDraft(
  value: unknown,
  user: { name?: string | null; email?: string | null } | null | undefined,
): CaseData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  const profileSource = draft.profileSource === "custom" ? "custom" : "account";
  const text = (key: string) => typeof draft[key] === "string" ? String(draft[key]).slice(0, 20_000) : "";
  return {
    clientName: profileSource === "account" ? user?.name || "" : text("clientName"),
    clientEmail: profileSource === "account" ? user?.email || "" : text("clientEmail"),
    clientPhone: text("clientPhone").slice(0, 80),
    legalArea: LEGAL_AREAS.includes(text("legalArea")) ? text("legalArea") : "",
    summary: text("summary"),
    urgency: "Medium",
    profileSource,
    uploadDocumentsAfterCreate: draft.uploadDocumentsAfterCreate === true,
  };
}

export function hasCaseDraftInput(
  draft: CaseData,
  user: { name?: string | null; email?: string | null } | null | undefined,
): boolean {
  return Boolean(
    draft.clientPhone.trim() ||
    draft.legalArea ||
    draft.summary.trim() ||
    draft.uploadDocumentsAfterCreate ||
    draft.profileSource === "custom" ||
    draft.clientName !== (user?.name || "") ||
    draft.clientEmail !== (user?.email || ""),
  );
}

export default function CaseCreationWizard({
  open,
  onOpenChange,
  onComplete,
}: CaseCreationWizardProps) {
  const { user } = useAuth();
  const [caseData, setCaseData] = useState<CaseData>(() => defaultCaseData(user));
  const [draftReady, setDraftReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editRevision = useRef(0);
  const pendingSave = useRef<Promise<unknown> | null>(null);
  const { refetch: refetchDraft } = trpc.cases.getDraft.useQuery(undefined, {
    enabled: false,
    staleTime: 0,
  });
  const { mutateAsync: saveDraftAsync } = trpc.cases.saveDraft.useMutation();
  const { mutateAsync: clearDraftAsync } = trpc.cases.clearDraft.useMutation();

  useEffect(() => {
    if (!open) {
      setCaseData(defaultCaseData(user));
      setDraftReady(false);
      setDirty(false);
      setIsSubmitting(false);
      editRevision.current = 0;
      return;
    }
    if (draftReady) return;
    let cancelled = false;
    void (async () => {
      if (pendingSave.current) await pendingSave.current.catch(() => undefined);
      const result = await refetchDraft();
      if (cancelled) return;
      setCaseData(normalizeCaseDraft(result.data?.draft, user) || defaultCaseData(user));
      setDraftReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [draftReady, open, refetchDraft, user]);

  useEffect(() => {
    if (!open || !draftReady || !dirty || !hasCaseDraftInput(caseData, user)) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const revision = editRevision.current;
    autosaveTimer.current = setTimeout(() => {
      const operation = saveDraftAsync({ draft: caseData });
      pendingSave.current = operation;
      void operation
        .then(() => {
          if (editRevision.current === revision) setDirty(false);
        })
        .catch(() => undefined)
        .finally(() => {
          if (pendingSave.current === operation) pendingSave.current = null;
        });
      autosaveTimer.current = null;
    }, 600);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [caseData, dirty, draftReady, open, saveDraftAsync, user]);

  const updateCaseData = (update: (current: CaseData) => CaseData) => {
    editRevision.current += 1;
    setDirty(true);
    setCaseData(update);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && dirty && hasCaseDraftInput(caseData, user)) {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      const operation = saveDraftAsync({ draft: caseData });
      pendingSave.current = operation;
      void operation.catch(() => undefined).finally(() => {
        if (pendingSave.current === operation) pendingSave.current = null;
      });
    }
    onOpenChange(nextOpen);
  };

  const submit = async () => {
    if (!caseData.clientName.trim() || !caseData.clientEmail.trim()) {
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(caseData.clientEmail)) {
      return;
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setIsSubmitting(true);
    try {
      if (pendingSave.current) {
        await pendingSave.current.catch(() => undefined);
      }
      if (hasCaseDraftInput(caseData, user)) {
        await saveDraftAsync({ draft: caseData });
      }
      const completed = await onComplete?.({ ...caseData });
      if (completed === false) return;
      await clearDraftAsync();
      editRevision.current = 0;
      setDirty(false);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New case</DialogTitle>
          <DialogDescription>
            Add a matter so LARO can organise evidence and match lawyers.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Contact source</Label>
            <Select
              value={caseData.profileSource}
              onValueChange={(v: "account" | "custom") => {
                if (v === "account") {
                  updateCaseData((d) => ({
                    ...d,
                    profileSource: "account",
                    clientName: user?.name || "",
                    clientEmail: user?.email || "",
                  }));
                } else {
                  updateCaseData((d) => ({
                    ...d,
                    profileSource: "custom",
                    clientName: "",
                    clientEmail: "",
                  }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="account">
                  My account{user?.email ? ` (${user.email})` : ""}
                </SelectItem>
                <SelectItem value="custom">Someone else / enter manually</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use your signed-in profile or enter different contact details for this matter.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ccw-name">Client name</Label>
            <Input
              id="ccw-name"
              value={caseData.clientName}
              disabled={caseData.profileSource === "account"}
              onChange={(e) =>
                updateCaseData((d) => ({ ...d, clientName: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ccw-email">Client email</Label>
            <Input
              id="ccw-email"
              type="email"
              value={caseData.clientEmail}
              disabled={caseData.profileSource === "account"}
              onChange={(e) =>
                updateCaseData((d) => ({ ...d, clientEmail: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ccw-phone">Phone (optional)</Label>
            <Input
              id="ccw-phone"
              value={caseData.clientPhone}
              onChange={(e) =>
                updateCaseData((d) => ({ ...d, clientPhone: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Legal area (Optional - AI will auto-detect)</Label>
            <Select
              value={caseData.legalArea || undefined}
              onValueChange={(v: string) =>
                updateCaseData((d) => ({ ...d, legalArea: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Optional — leave blank for AI to detect" />
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
            <Label htmlFor="ccw-summary">Case summary</Label>
            <Textarea
              id="ccw-summary"
              rows={16}
              value={caseData.summary}
              onChange={(e) =>
                updateCaseData((d) => ({ ...d, summary: e.target.value }))
              }
              placeholder="Describe the case details here. LARO will analyze the description and automatically determine relevant legal areas from uploaded evidence."
              className="min-h-[240px]"
            />
            <p className="text-xs text-muted-foreground">
              Optional. You can create a case with documentation only and let LARO analyze the documents first.
            </p>
          </div>
          <label className="flex items-start gap-3 rounded-md border border-border/60 p-3">
            <input
              type="checkbox"
              checked={caseData.uploadDocumentsAfterCreate}
              onChange={(e) =>
                updateCaseData((d) => ({ ...d, uploadDocumentsAfterCreate: e.target.checked }))
              }
              className="mt-1 h-4 w-4"
            />
            <span className="text-sm text-muted-foreground">
              Open document upload immediately after creating this case.
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isSubmitting || !draftReady}>
            {isSubmitting ? "Creating..." : "Create case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
