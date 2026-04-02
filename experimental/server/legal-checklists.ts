/**
 * Legal Evidence and Procedural Checklists
 * 
 * This file defines TypeScript types and data structures for validating
 * evidence completeness and procedural compliance across all Dutch legal areas.
 */

export type LegalArea =
  | "employment_wrongful_termination"
  | "civil_contract_disputes"
  | "family_divorce"
  | "consumer_protection"
  | "medical_malpractice"
  | "real_estate_purchase"
  | "real_estate_rental"
  | "criminal_defense"
  | "immigration"
  | "administrative_law"
  | "tax_law"
  | "intellectual_property"
  | "insurance_claims"
  | "traffic_accidents"
  | "neighbor_disputes"
  | "inheritance_disputes"
  | "environmental_law"
  | "construction_defects"
  | "data_protection_gdpr"
  | "employment_discrimination";

export type EvidenceType =
  | "required" // Mandatory for case success
  | "supporting" // Strengthens the case
  | "timeline_critical" // Must be obtained by specific deadline
  | "commonly_overlooked" // Often forgotten but important
  | "red_flag"; // Missing this suggests case will fail

export type ProceduralStepType =
  | "critical_deadline" // Miss this = case dismissed
  | "required_form" // Must file this form
  | "filing_sequence" // Must follow this order
  | "service_requirement" // How documents must be served
  | "mandatory_prerequisite" // Must complete before proceeding
  | "common_error"; // Common mistake that causes dismissal

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  consequences_if_missing: string;
  deadline?: string; // e.g., "immediately", "within 3 months", "before trial"
  examples?: string[];
}

export interface ProceduralStep {
  id: string;
  type: ProceduralStepType;
  title: string;
  description: string;
  deadline?: string;
  consequences_if_missed: string;
  sequence_order?: number; // For filing_sequence steps
  examples?: string[];
}

export interface LegalAreaChecklist {
  legal_area: LegalArea;
  display_name: string;
  description: string;
  evidence_items: EvidenceItem[];
  procedural_steps: ProceduralStep[];
}

export interface CaseValidationResult {
  case_id: number;
  legal_area: LegalArea;
  evidence_completeness: {
    total_required: number;
    provided: number;
    missing: EvidenceItem[];
    percentage: number;
  };
  procedural_compliance: {
    total_steps: number;
    completed: number;
    pending: ProceduralStep[];
    percentage: number;
  };
  red_flags: EvidenceItem[];
  critical_deadlines_approaching: ProceduralStep[];
  common_errors_detected: ProceduralStep[];
  overall_readiness_score: number; // 0-100
  recommendations: string[];
}

/**
 * Employment Law - Wrongful Termination Checklist
 */
export const EMPLOYMENT_WRONGFUL_TERMINATION_CHECKLIST: LegalAreaChecklist = {
  legal_area: "employment_wrongful_termination",
  display_name: "Employment Law - Wrongful Termination",
  description: "Checklist for wrongful termination and dismissal cases in the Netherlands",
  
  evidence_items: [
    {
      id: "emp_wt_001",
      type: "required",
      title: "Employment Contract",
      description: "Original signed employment contract (arbeidsovereenkomst) showing terms of employment, salary, position, start date",
      consequences_if_missing: "Cannot prove employment relationship or terms. Case will fail.",
      examples: ["Signed arbeidsovereenkomst", "Collective labor agreement (CAO)", "Letter of appointment"]
    },
    {
      id: "emp_wt_002",
      type: "required",
      title: "Termination Letter",
      description: "Official termination letter from employer stating reason for dismissal, effective date, notice period",
      consequences_if_missing: "Cannot prove dismissal occurred or employer's stated reason. Case will fail.",
      deadline: "Received at time of dismissal",
      examples: ["Ontslag brief", "UWV dismissal permit", "Court dismissal order", "Mutual termination agreement"]
    },
    {
      id: "emp_wt_003",
      type: "required",
      title: "Performance Reviews",
      description: "Annual performance evaluations, feedback documents showing work quality and behavior",
      consequences_if_missing: "Cannot prove you were performing adequately. Employer's performance claims go unchallenged.",
      examples: ["Functioneringsgesprekken", "Beoordelingsgesprekken", "Performance improvement plans", "Warning letters"]
    },
    {
      id: "emp_wt_004",
      type: "supporting",
      title: "Salary Slips",
      description: "Pay stubs showing salary, bonuses, benefits over employment period",
      consequences_if_missing: "Cannot prove full compensation for transition payment calculation",
      examples: ["Loonstroken", "Bank statements showing salary deposits"]
    },
    {
      id: "emp_wt_005",
      type: "supporting",
      title: "Email and Communication Records",
      description: "Emails, Slack messages, Teams chats showing work performance, conflicts, discriminatory remarks",
      consequences_if_missing: "Cannot prove employer's real motivation or discriminatory animus",
      examples: ["Email threads with manager", "Performance feedback emails", "Discriminatory comments", "Retaliation evidence"]
    },
    {
      id: "emp_wt_006",
      type: "timeline_critical",
      title: "Medical Records (if illness-related)",
      description: "Doctor's notes, sick leave certificates if dismissal related to illness or disability",
      consequences_if_missing: "Cannot prove illness or that employer knew about it. Employer may claim you were absent without cause.",
      deadline: "Obtain during illness period",
      examples: ["Ziekmelding", "Doctor's certificate", "Occupational health assessment", "Arbodienst reports"]
    },
    {
      id: "emp_wt_007",
      type: "commonly_overlooked",
      title: "Witness Statements",
      description: "Written statements from coworkers who witnessed discriminatory behavior, good performance, or procedural violations",
      consequences_if_missing: "Your word vs. employer's. Harder to prove claims without corroboration.",
      examples: ["Colleague testimony", "Manager statements", "HR witness accounts"]
    },
    {
      id: "emp_wt_008",
      type: "commonly_overlooked",
      title: "Company Policies and Handbook",
      description: "Employee handbook, dismissal procedures, disciplinary policies showing employer's own rules",
      consequences_if_missing: "Cannot prove employer violated its own procedures",
      examples: ["Personeelshandboek", "Dismissal policy", "Disciplinary procedure", "CAO provisions"]
    },
    {
      id: "emp_wt_009",
      type: "red_flag",
      title: "Prior Warnings or Disciplinary Actions",
      description: "Written warnings, performance improvement plans, disciplinary letters showing employer followed progressive discipline",
      consequences_if_missing: "If employer has these and you don't, suggests dismissal was justified. If neither party has them, suggests employer didn't follow procedure.",
      examples: ["Warning letters", "Performance improvement plans", "Suspension letters"]
    },
    {
      id: "emp_wt_010",
      type: "red_flag",
      title: "Signed Termination Agreement",
      description: "If you signed a mutual termination agreement (vaststellingsovereenkomst) waiving claims",
      consequences_if_missing: "If you signed this, you likely waived your right to challenge dismissal. Case will fail unless agreement was signed under duress or fraud.",
      examples: ["Vaststellingsovereenkomst", "Settlement agreement", "Release of claims"]
    }
  ],
  
  procedural_steps: [
    {
      id: "emp_wt_proc_001",
      type: "critical_deadline",
      title: "Object to Dismissal",
      description: "Must object to dismissal within 2 months of termination to preserve right to challenge",
      deadline: "2 months from termination date",
      consequences_if_missed: "Dismissal becomes final. Cannot challenge later. Right to sue is lost.",
      examples: ["Send registered letter objecting to dismissal", "File lawsuit within 2 months"]
    },
    {
      id: "emp_wt_proc_002",
      type: "critical_deadline",
      title: "Request Transition Payment",
      description: "Must request transition payment (transitievergoeding) within 3 years of termination",
      deadline: "3 years from termination date",
      consequences_if_missed: "Cannot claim transition payment. Right is lost.",
      examples: ["Demand letter to employer", "Lawsuit for transition payment"]
    },
    {
      id: "emp_wt_proc_003",
      type: "required_form",
      title: "Summons (Dagvaarding)",
      description: "Formal court summons must be filed with Sub-district Court (Kantonrechter) to challenge dismissal",
      deadline: "Within 2 months of termination",
      consequences_if_missed: "Cannot bring case to court. Dismissal stands.",
      examples: ["Dagvaarding filed by lawyer", "Court filing receipt"]
    },
    {
      id: "emp_wt_proc_004",
      type: "filing_sequence",
      title: "Dismissal Challenge Procedure",
      description: "Step 1: Termination occurs → Step 2: Review termination letter → Step 3: Gather evidence → Step 4: Consult lawyer → Step 5: Send objection letter (within 2 months) → Step 6: File lawsuit (within 2 months) → Step 7: Court hearing → Step 8: Judgment (reinstatement or compensation)",
      sequence_order: 1,
      consequences_if_missed: "Missing Step 5 or 6 deadline = case dismissed. Must follow order.",
      examples: ["Complete sequence within 2-month window"]
    },
    {
      id: "emp_wt_proc_005",
      type: "service_requirement",
      title: "Serve Summons via Bailiff",
      description: "Court summons must be served on employer by bailiff (gerechtsdeurwaarder). Cannot serve yourself.",
      consequences_if_missed: "Service invalid. Case may be dismissed. Must re-serve properly.",
      examples: ["Bailiff serves summons at employer's registered address", "Proof of service (exploot)"]
    },
    {
      id: "emp_wt_proc_006",
      type: "mandatory_prerequisite",
      title: "Employer Must Have Dismissal Permit or Court Order",
      description: "Employer can only dismiss with: (a) UWV permit for economic reasons, (b) Court order for other grounds, or (c) Mutual agreement. Dismissal without one of these is void.",
      consequences_if_missed: "If employer dismissed without permit/order, dismissal is void. You can demand reinstatement or compensation.",
      examples: ["Check if employer has UWV ontslagvergunning", "Check if court granted dismissal", "Check if you signed mutual termination"]
    },
    {
      id: "emp_wt_proc_007",
      type: "common_error",
      title: "Missing 2-Month Objection Deadline",
      description: "Most common error: Not objecting within 2 months. After 2 months, dismissal becomes final and cannot be challenged.",
      consequences_if_missed: "Case dismissed. No remedy available.",
      examples: ["Employee waits 3 months to consult lawyer", "Misses deadline", "Case dismissed"]
    },
    {
      id: "emp_wt_proc_008",
      type: "common_error",
      title: "Signing Termination Agreement Without Legal Advice",
      description: "Employees often sign vaststellingsovereenkomst without understanding they're waiving all claims. Once signed, very difficult to challenge.",
      consequences_if_missed: "Waived all rights. Cannot sue for wrongful termination.",
      examples: ["Employer offers severance", "Employee signs without lawyer", "Later discovers they could have gotten more"]
    },
    {
      id: "emp_wt_proc_009",
      type: "common_error",
      title: "Not Preserving Evidence",
      description: "Employees often lose access to company email, documents after termination. Must save evidence before leaving.",
      consequences_if_missed: "Cannot prove claims. Your word vs. employer's.",
      examples: ["Save emails to personal account", "Print documents", "Screenshot Slack messages"]
    }
  ]
};

/**
 * Get checklist for a specific legal area
 */
export function getChecklistForLegalArea(legalArea: LegalArea): LegalAreaChecklist | null {
  // For now, only employment wrongful termination is implemented
  // TODO: Add other 19 legal areas
  if (legalArea === "employment_wrongful_termination") {
    return EMPLOYMENT_WRONGFUL_TERMINATION_CHECKLIST;
  }
  return null;
}

/**
 * Validate case evidence and procedural compliance
 */
export function validateCase(
  legalArea: LegalArea,
  providedEvidence: string[], // IDs of evidence items user has provided
  completedSteps: string[] // IDs of procedural steps user has completed
): CaseValidationResult {
  const checklist = getChecklistForLegalArea(legalArea);
  if (!checklist) {
    throw new Error(`No checklist found for legal area: ${legalArea}`);
  }

  // Calculate evidence completeness
  const requiredEvidence = checklist.evidence_items.filter(e => e.type === "required");
  const missingRequired = requiredEvidence.filter(e => !providedEvidence.includes(e.id));
  const evidencePercentage = ((requiredEvidence.length - missingRequired.length) / requiredEvidence.length) * 100;

  // Identify red flags
  const redFlags = checklist.evidence_items
    .filter(e => e.type === "red_flag" && providedEvidence.includes(e.id));

  // Calculate procedural compliance
  const criticalSteps = checklist.procedural_steps.filter(s => s.type === "critical_deadline" || s.type === "mandatory_prerequisite");
  const pendingCritical = criticalSteps.filter(s => !completedSteps.includes(s.id));
  const proceduralPercentage = ((criticalSteps.length - pendingCritical.length) / criticalSteps.length) * 100;

  // Identify approaching deadlines
  const deadlinesApproaching = checklist.procedural_steps
    .filter(s => s.type === "critical_deadline" && !completedSteps.includes(s.id));

  // Identify common errors
  const commonErrors = checklist.procedural_steps
    .filter(s => s.type === "common_error");

  // Calculate overall readiness score
  const overallScore = (evidencePercentage * 0.6) + (proceduralPercentage * 0.4);

  // Generate recommendations
  const recommendations: string[] = [];
  if (missingRequired.length > 0) {
    recommendations.push(`You are missing ${missingRequired.length} required evidence items. Your case may fail without these.`);
  }
  if (redFlags.length > 0) {
    recommendations.push(`Warning: ${redFlags.length} red flags detected. These suggest your case may be difficult to win.`);
  }
  if (pendingCritical.length > 0) {
    recommendations.push(`You have ${pendingCritical.length} critical procedural steps pending. Missing these deadlines will result in case dismissal.`);
  }
  if (overallScore < 50) {
    recommendations.push("Your case readiness is below 50%. We strongly recommend gathering more evidence and consulting a lawyer before proceeding.");
  }

  return {
    case_id: 0, // Will be set by caller
    legal_area: legalArea,
    evidence_completeness: {
      total_required: requiredEvidence.length,
      provided: requiredEvidence.length - missingRequired.length,
      missing: missingRequired,
      percentage: evidencePercentage
    },
    procedural_compliance: {
      total_steps: criticalSteps.length,
      completed: criticalSteps.length - pendingCritical.length,
      pending: pendingCritical,
      percentage: proceduralPercentage
    },
    red_flags: redFlags,
    critical_deadlines_approaching: deadlinesApproaching,
    common_errors_detected: commonErrors,
    overall_readiness_score: overallScore,
    recommendations
  };
}

