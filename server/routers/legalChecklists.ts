import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  LegalArea,
  getChecklistForLegalArea,
  validateCase,
  EMPLOYMENT_WRONGFUL_TERMINATION_CHECKLIST
} from "../legal-checklists";

/**
 * Legal Checklists Router
 * 
 * Provides API endpoints for evidence and procedural validation
 */
export const legalChecklistsRouter = router({
  /**
   * Get checklist for a specific legal area
   */
  getChecklist: publicProcedure
    .input(z.object({
      legalArea: z.enum([
        "employment_wrongful_termination",
        "civil_contract_disputes",
        "family_divorce",
        "consumer_protection",
        "medical_malpractice",
        "real_estate_purchase",
        "real_estate_rental",
        "criminal_defense",
        "immigration",
        "administrative_law",
        "tax_law",
        "intellectual_property",
        "insurance_claims",
        "traffic_accidents",
        "neighbor_disputes",
        "inheritance_disputes",
        "environmental_law",
        "construction_defects",
        "data_protection_gdpr",
        "employment_discrimination"
      ])
    }))
    .query(({ input }) => {
      const checklist = getChecklistForLegalArea(input.legalArea as LegalArea);
      if (!checklist) {
        throw new Error(`Checklist not yet implemented for: ${input.legalArea}`);
      }
      return checklist;
    }),

  /**
   * Validate case evidence and procedural compliance
   */
  validateCase: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      legalArea: z.enum([
        "employment_wrongful_termination",
        "civil_contract_disputes",
        "family_divorce",
        "consumer_protection",
        "medical_malpractice",
        "real_estate_purchase",
        "real_estate_rental",
        "criminal_defense",
        "immigration",
        "administrative_law",
        "tax_law",
        "intellectual_property",
        "insurance_claims",
        "traffic_accidents",
        "neighbor_disputes",
        "inheritance_disputes",
        "environmental_law",
        "construction_defects",
        "data_protection_gdpr",
        "employment_discrimination"
      ]),
      providedEvidence: z.array(z.string()), // Evidence item IDs
      completedSteps: z.array(z.string()) // Procedural step IDs
    }))
    .mutation(({ input }) => {
      const result = validateCase(
        input.legalArea as LegalArea,
        input.providedEvidence,
        input.completedSteps
      );
      result.case_id = input.caseId;
      return result;
    }),

  /**
   * Get all available legal areas
   */
  getLegalAreas: publicProcedure
    .query(() => {
      return [
        { id: "employment_wrongful_termination", name: "Employment Law - Wrongful Termination", implemented: true },
        { id: "civil_contract_disputes", name: "Civil Law - Contract Disputes", implemented: false },
        { id: "family_divorce", name: "Family Law - Divorce", implemented: false },
        { id: "consumer_protection", name: "Consumer Protection", implemented: false },
        { id: "medical_malpractice", name: "Medical Malpractice & Healthcare", implemented: false },
        { id: "real_estate_purchase", name: "Real Estate - Property Purchase", implemented: false },
        { id: "real_estate_rental", name: "Real Estate - Rental Disputes", implemented: false },
        { id: "criminal_defense", name: "Criminal Law - Defense", implemented: false },
        { id: "immigration", name: "Immigration Law", implemented: false },
        { id: "administrative_law", name: "Administrative Law", implemented: false },
        { id: "tax_law", name: "Tax Law", implemented: false },
        { id: "intellectual_property", name: "Intellectual Property", implemented: false },
        { id: "insurance_claims", name: "Insurance Law - Claims", implemented: false },
        { id: "traffic_accidents", name: "Traffic Law - Accidents", implemented: false },
        { id: "neighbor_disputes", name: "Neighbor Law - Disputes", implemented: false },
        { id: "inheritance_disputes", name: "Inheritance Law - Estate Disputes", implemented: false },
        { id: "environmental_law", name: "Environmental Law", implemented: false },
        { id: "construction_defects", name: "Construction Law - Defects", implemented: false },
        { id: "data_protection_gdpr", name: "Data Protection (GDPR)", implemented: false },
        { id: "employment_discrimination", name: "Employment Discrimination", implemented: false }
      ];
    }),

  /**
   * Get evidence items by type for a legal area
   */
  getEvidenceByType: publicProcedure
    .input(z.object({
      legalArea: z.string(),
      type: z.enum(["required", "supporting", "timeline_critical", "commonly_overlooked", "red_flag"])
    }))
    .query(({ input }) => {
      const checklist = getChecklistForLegalArea(input.legalArea as LegalArea);
      if (!checklist) {
        throw new Error(`Checklist not yet implemented for: ${input.legalArea}`);
      }
      return checklist.evidence_items.filter(item => item.type === input.type);
    }),

  /**
   * Get procedural steps by type for a legal area
   */
  getProceduralStepsByType: publicProcedure
    .input(z.object({
      legalArea: z.string(),
      type: z.enum(["critical_deadline", "required_form", "filing_sequence", "service_requirement", "mandatory_prerequisite", "common_error"])
    }))
    .query(({ input }) => {
      const checklist = getChecklistForLegalArea(input.legalArea as LegalArea);
      if (!checklist) {
        throw new Error(`Checklist not yet implemented for: ${input.legalArea}`);
      }
      return checklist.procedural_steps.filter(step => step.type === input.type);
    })
});

