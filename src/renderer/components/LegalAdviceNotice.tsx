import { Scale } from "lucide-react";

export function LegalAdviceNotice() {
  return (
    <aside
      role="note"
      aria-label="Legal assistance notice"
      className="mt-8 flex items-start gap-2 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground"
    >
      <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-medium text-foreground">Legal assistance, not legal advice.</span>{" "}
        Have important analyses and generated documents reviewed by a qualified lawyer before relying on them.
      </p>
    </aside>
  );
}
