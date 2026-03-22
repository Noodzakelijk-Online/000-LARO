/**
 * AI-Powered Legal Area Inference Service
 * 
 * Analyzes case summaries and infers relevant Dutch legal areas
 * based on the official Nederlandse Orde van Advocaten taxonomy.
 */

import { invokeLLM } from "./llm";
import * as fs from "fs";
import * as path from "path";

interface TaxonomyMapping {
  courtCategoryToSpecializations: Record<string, string[]>;
  specializationToCourtCategories: Record<string, string[]>;
  confidenceScores: {
    directMatch: number;
    strongMatch: number;
    moderateMatch: number;
    weakMatch: number;
  };
}

interface LegalAreaInference {
  area: string; // Dutch name (e.g., "Arbeidsrecht")
  areaEn: string; // English name (e.g., "Employment Law")
  confidence: number; // 0.0 to 1.0
  reasoning: string; // Why this area was identified
}

interface InferenceResult {
  legalAreas: LegalAreaInference[];
  primaryArea: string; // Most relevant area
  summary: string; // Brief explanation for user
}

/**
 * Load taxonomy mapping between court categories and lawyer specializations
 */
function loadTaxonomyMapping(): TaxonomyMapping | null {
  try {
    const mappingPath = path.join(__dirname, "legal-taxonomy-mapping.json");
    if (!fs.existsSync(mappingPath)) {
      console.warn("Taxonomy mapping file not found");
      return null;
    }
    return JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
  } catch (error) {
    console.error("Error loading taxonomy mapping:", error);
    return null;
  }
}

/**
 * Load TF-IDF keywords from rechtspraak.nl full analysis (877k cases)
 */
function loadRechtspraakKeywordsFull(): Record<string, string[]> {
  try {
    const keywordsPath = path.join(process.cwd(), "docs/rechtspraak-keywords-full.json");
    if (!fs.existsSync(keywordsPath)) {
      console.warn("Full rechtspraak keywords file not found, trying sample version");
      return loadRechtspraakKeywordsSample();
    }
    
    const data = JSON.parse(fs.readFileSync(keywordsPath, "utf-8"));
    const keywordsByArea: Record<string, string[]> = {};
    
    // Load keywords from 877k case analysis
    for (const [areaName, areaData] of Object.entries(data.keywords_by_area || {})) {
      const keywords = (areaData as any).top_keywords
        .filter((kw: any) => {
          const keyword = kw.keyword.toLowerCase();
          return !keyword.startsWith("rb") &&
                 !keyword.match(/^[a-z]{2,4}$/) &&
                 keyword.length > 3 &&
                 kw.tfidf_score > 0.05;
        })
        .slice(0, 50) // Top 50 keywords from 877k cases
        .map((kw: any) => kw.keyword);
      
      if (keywords.length > 0) {
        keywordsByArea[areaName] = keywords;
        console.log(`[AI Inference] Loaded ${keywords.length} keywords for ${areaName} from 877k cases`);
      }
    }
    
    return keywordsByArea;
  } catch (error) {
    console.error("Error loading full rechtspraak keywords:", error);
    return loadRechtspraakKeywordsSample();
  }
}

/**
 * Load TF-IDF keywords from rechtspraak.nl sample analysis (5.4k cases) - fallback
 */
function loadRechtspraakKeywordsSample(): Record<string, string[]> {
  try {
    const keywordsPath = path.join(process.cwd(), "docs/rechtspraak-keywords-analysis.json");
    if (!fs.existsSync(keywordsPath)) {
      console.warn("Rechtspraak keywords file not found, using manual keywords only");
      return {};
    }
    
    const data = JSON.parse(fs.readFileSync(keywordsPath, "utf-8"));
    const keywordsByArea: Record<string, string[]> = {};
    
    for (const [areaName, areaData] of Object.entries(data.keywords_by_area)) {
      const keywords = (areaData as any).top_keywords
        .filter((kw: any) => {
          // Filter out court names and procedural terms
          const keyword = kw.keyword.toLowerCase();
          return !keyword.startsWith("rb") && // Court abbreviations
                 !keyword.match(/^[a-z]{2,4}$/) && // Short codes
                 keyword.length > 3 && // Too short
                 kw.tfidf_score > 0.05; // Low relevance
        })
        .slice(0, 30) // Top 30 keywords per area
        .map((kw: any) => kw.keyword);
      
      keywordsByArea[areaName] = keywords;
    }
    
    console.log(`Loaded rechtspraak keywords for ${Object.keys(keywordsByArea).length} legal areas`);
    return keywordsByArea;
  } catch (error) {
    console.error("Error loading rechtspraak keywords:", error);
    return {};
  }
}

// Load rechtspraak keywords once at startup
const RECHTSPRAAK_KEYWORDS = loadRechtspraakKeywordsFull();

/**
 * Official Dutch legal areas from Nederlandse Orde van Advocaten
 * Source: https://www.advocatenorde.nl/document/bijlage-9-lijst-van-rechtsgebieden
 * Enhanced with TF-IDF keywords from 5,400 analyzed court cases
 */
const DUTCH_LEGAL_AREAS = [
  { nl: "Algemene praktijk", en: "General Practice", keywords: ["algemeen", "general"] },
  { nl: "Personen- en Familierecht", en: "Family and Personal Law", keywords: ["echtscheiding", "divorce", "custody", "alimentatie", "alimony", "kinderen", "children", "familie", "family", "huwelijk", "marriage"] },
  { nl: "Erfrecht", en: "Inheritance Law", keywords: ["erfenis", "inheritance", "testament", "will", "nalatenschap", "estate"] },
  { nl: "Arbeidsrecht", en: "Employment Law", keywords: ["ontslag", "dismissal", "fired", "werkgever", "employer", "werknemer", "employee", "arbeidscontract", "employment contract", "loon", "salary", "wages"] },
  { nl: "Sociaal zekerheidsrecht", en: "Social Security Law", keywords: ["uitkering", "benefits", "ww", "unemployment", "sociale zekerheid", "social security"] },
  { nl: "Ambtenarenrecht", en: "Civil Service Law", keywords: ["ambtenaar", "civil servant", "overheid", "government employee"] },
  { nl: "Huurrecht", en: "Rental Law", keywords: ["huur", "rent", "verhuurder", "landlord", "huurder", "tenant", "woning", "housing", "appartement", "apartment"] },
  { nl: "Verbintenissenrecht", en: "Law of Obligations", keywords: ["contract", "overeenkomst", "agreement", "breach", "schending"] },
  { nl: "Sportrecht", en: "Sports Law", keywords: ["sport", "athlete", "club", "vereniging"] },
  { nl: "Intellectueel eigendomsrecht", en: "Intellectual Property Law", keywords: ["patent", "trademark", "copyright", "auteursrecht", "merk", "intellectueel eigendom"] },
  { nl: "Economisch ordeningsrecht", en: "Economic Regulation Law", keywords: ["mededinging", "competition", "kartel", "cartel", "markt", "market"] },
  { nl: "Aanbestedingsrecht", en: "Public Procurement Law", keywords: ["aanbesteding", "procurement", "tender", "offerte"] },
  { nl: "Ondernemingsrecht", en: "Corporate Law", keywords: ["bedrijf", "company", "bv", "nv", "corporation", "fusie", "merger", "overname", "acquisition"] },
  { nl: "Burgerlijk procesrecht", en: "Civil Procedure Law", keywords: ["rechtszaak", "lawsuit", "rechter", "judge", "procedure", "proces", "trial"] },
  { nl: "Transport- en handelsrecht", en: "Transport and Commercial Law", keywords: ["transport", "shipping", "handel", "trade", "commercieel", "commercial"] },
  { nl: "Financieel recht", en: "Financial Law", keywords: ["bank", "financieel", "financial", "lening", "loan", "krediet", "credit"] },
  { nl: "Verzekeringsrecht", en: "Insurance Law", keywords: ["verzekering", "insurance", "claim", "polis", "policy"] },
  { nl: "Belastingrecht", en: "Tax Law", keywords: ["belasting", "tax", "btw", "vat", "inkomstenbelasting", "income tax"] },
  { nl: "Privacy recht", en: "Privacy Law", keywords: ["privacy", "avg", "gdpr", "data", "persoonsgegevens", "personal data"] },
  { nl: "Informatierecht", en: "Information Law", keywords: ["media", "it", "internet", "software", "website"] },
  { nl: "Insolventierecht", en: "Insolvency Law", keywords: ["faillissement", "bankruptcy", "insolvent", "schulden", "debt", "surseance"] },
  { nl: "Strafrecht", en: "Criminal Law", keywords: ["strafbaar", "criminal", "politie", "police", "aangifte", "report", "misdrijf", "crime", "delict", "offense"] },
  { nl: "Psychiatrisch patiëntenrecht", en: "Psychiatric Patient Law", keywords: ["psychiatrie", "psychiatric", "mental health", "gedwongen opname", "involuntary admission"] },
  { nl: "Letselschaderecht", en: "Personal Injury Law", keywords: ["letsel", "injury", "ongeval", "accident", "schade", "damage", "verwonding", "wounded"] },
  { nl: "Slachtofferrecht", en: "Victim Law", keywords: ["slachtoffer", "victim", "misdrijf", "crime"] },
  { nl: "Bestuursrecht", en: "Administrative Law", keywords: ["overheid", "government", "gemeente", "municipality", "vergunning", "permit", "bezwaar", "objection"] },
  { nl: "Vreemdelingenrecht", en: "Immigration Law", keywords: ["vreemdeling", "foreigner", "immigrant", "visa", "verblijf", "residence", "asiel", "asylum"] },
  { nl: "Asiel- en vluchtelingenrecht", en: "Asylum and Refugee Law", keywords: ["asiel", "asylum", "vluchteling", "refugee"] },
  { nl: "Omgevingsrecht", en: "Environmental Law", keywords: ["milieu", "environment", "natuur", "nature", "water", "vervuiling", "pollution"] },
  { nl: "Gezondheidsrecht", en: "Health Law", keywords: ["gezondheid", "health", "ziekenhuis", "hospital", "arts", "doctor", "medisch", "medical"] },
  { nl: "Onderwijsrecht", en: "Education Law", keywords: ["onderwijs", "education", "school", "universiteit", "university", "student"] },
  { nl: "Onteigeningsrecht", en: "Expropriation Law", keywords: ["onteigening", "expropriation", "grond", "land"] },
  { nl: "Vastgoedrecht", en: "Real Estate Law", keywords: ["vastgoed", "real estate", "eigendom", "property", "bouw", "construction", "koop", "purchase"] },
  { nl: "Agrarisch recht", en: "Agricultural Law", keywords: ["landbouw", "agriculture", "boer", "farmer", "agrarisch", "agricultural"] },
  { nl: "Tuchtrecht", en: "Disciplinary Law", keywords: ["tuchtrecht", "disciplinary", "beroepsfout", "professional error"] },
  { nl: "Cassatie", en: "Supreme Court Appeals", keywords: ["cassatie", "supreme court", "hoge raad"] },
];

/**
 * Infer legal areas using keyword matching (fallback method)
 */
function inferLegalAreasKeywordBased(caseSummary: string): InferenceResult {
  const lowerSummary = caseSummary.toLowerCase();
  const inferences: LegalAreaInference[] = [];

  // Keyword-based matching with enhanced rechtspraak keywords
  for (const area of DUTCH_LEGAL_AREAS) {
    let matchCount = 0;
    const matchedKeywords: string[] = [];

    // Match manual keywords
    for (const keyword of area.keywords) {
      if (lowerSummary.includes(keyword.toLowerCase())) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    }

    // Match rechtspraak TF-IDF keywords (if available)
    const rechtspraakKeywords = RECHTSPRAAK_KEYWORDS[area.nl] || [];
    for (const keyword of rechtspraakKeywords) {
      if (lowerSummary.includes(keyword.toLowerCase())) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    }

    if (matchCount > 0) {
      // Confidence based on match count, with bonus for rechtspraak matches
      const rechtspraakMatches = matchedKeywords.filter(kw => rechtspraakKeywords.includes(kw)).length;
      const baseConfidence = Math.min(matchCount / 5, 0.9);
      const rechtspraakBonus = rechtspraakMatches > 0 ? 0.1 : 0;
      const confidence = Math.min(baseConfidence + rechtspraakBonus, 1.0);
      
      inferences.push({
        area: area.nl,
        areaEn: area.en,
        confidence,
        reasoning: `Matched ${matchCount} keywords (${rechtspraakMatches} from court cases): ${matchedKeywords.slice(0, 5).join(", ")}${matchedKeywords.length > 5 ? "..." : ""}`,
      });
    }
  }

  // Sort by confidence (highest first)
  inferences.sort((a, b) => b.confidence - a.confidence);

  // Take top 3 most relevant areas
  const topAreas = inferences.slice(0, 3);

  // If no matches, default to General Practice
  if (topAreas.length === 0) {
    topAreas.push({
      area: "Algemene praktijk",
      areaEn: "General Practice",
      confidence: 0.5,
      reasoning: "No specific legal area identified, defaulting to general practice",
    });
  }

  const primaryArea = topAreas[0].area;
  const areaNames = topAreas.map(a => a.areaEn).join(", ");
  
  return {
    legalAreas: topAreas,
    primaryArea,
    summary: `This case appears to involve: ${areaNames}`,
  };
}

/**
 * Enhanced AI inference using LLM for sophisticated analysis
 */
export async function inferLegalAreas(caseSummary: string): Promise<InferenceResult> {
  try {
    // Build the legal areas list for the LLM
    const legalAreasList = DUTCH_LEGAL_AREAS.map(area => 
      `- ${area.nl} (${area.en})`
    ).join('\n');

    const systemPrompt = `You are a Dutch legal expert specializing in categorizing legal cases according to the Nederlandse Orde van Advocaten (Dutch Bar Association) official taxonomy.

Your task is to analyze a case description and identify the most relevant legal areas from the official 36 hoofdrechtsgebieden (main legal areas).

Official Dutch Legal Areas:
${legalAreasList}

Instructions:
1. Read the case description carefully, paying attention to:
   - Key legal terms and concepts mentioned
   - The nature of the dispute or legal issue
   - Parties involved (individuals, companies, government)
   - Context clues (workplace, family, property, etc.)
2. Identify the top 1-3 most relevant legal areas (prefer 1-2 unless truly multi-disciplinary)
3. Provide confidence scores:
   - 0.9-1.0: Very clear match with explicit legal terms
   - 0.7-0.89: Strong match based on context and keywords
   - 0.5-0.69: Moderate match, some ambiguity
   - Below 0.5: Uncertain, avoid unless necessary
4. Explain your reasoning in Dutch, citing specific words/phrases from the case
5. Return ONLY valid JSON matching the schema

Common Patterns:
- Divorce, custody, alimony → Personen- en familierecht
- Employment disputes, dismissal → Arbeidsrecht
- Landlord-tenant issues → Huurrecht
- Traffic accidents, personal injury → Aansprakelijkheidsrecht / Letselschade
- Business disputes → Ondernemingsrecht
- Debt collection → Incasso
- Criminal charges → Strafrecht`;

    const userPrompt = `Analyze this case and identify relevant legal areas.

Case Description:
"${caseSummary}"

Provide:
1. The most relevant legal area(s) (1-3 maximum)
2. Confidence scores based on clarity of legal indicators
3. Reasoning in Dutch citing specific terms from the case

Return your analysis as JSON.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "legal_area_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              legal_areas: {
                type: "array",
                description: "List of relevant legal areas, ordered by relevance",
                items: {
                  type: "object",
                  properties: {
                    area_nl: {
                      type: "string",
                      description: "Dutch name of the legal area (must match official taxonomy)"
                    },
                    area_en: {
                      type: "string",
                      description: "English name of the legal area"
                    },
                    confidence: {
                      type: "number",
                      description: "Confidence score from 0.0 to 1.0"
                    },
                    reasoning: {
                      type: "string",
                      description: "Brief explanation in Dutch why this area is relevant"
                    }
                  },
                  required: ["area_nl", "area_en", "confidence", "reasoning"],
                  additionalProperties: false
                }
              },
              primary_area: {
                type: "string",
                description: "The most relevant legal area (Dutch name)"
              },
              summary: {
                type: "string",
                description: "Brief summary in Dutch explaining the legal categorization"
              }
            },
            required: ["legal_areas", "primary_area", "summary"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      console.warn('[AI Inference] No valid response from LLM, falling back to keyword matching');
      return inferLegalAreasKeywordBased(caseSummary);
    }

    const result = JSON.parse(content);
    
    // Validate that returned areas exist in official taxonomy
    const validAreas = result.legal_areas.filter((area: any) => {
      const exists = DUTCH_LEGAL_AREAS.some(official => 
        official.nl === area.area_nl || official.en === area.area_en
      );
      if (!exists) {
        console.warn(`[AI Inference] Invalid legal area returned: ${area.area_nl}`);
      }
      return exists;
    });

    // If no valid areas, fall back to keyword matching
    if (validAreas.length === 0) {
      console.warn('[AI Inference] No valid legal areas returned, falling back to keyword matching');
      return inferLegalAreasKeywordBased(caseSummary);
    }
    
    // Transform LLM response to our format
    const legalAreas: LegalAreaInference[] = validAreas.map((area: any) => ({
      area: area.area_nl,
      areaEn: area.area_en,
      confidence: Math.min(Math.max(area.confidence, 0), 1), // Clamp to [0, 1]
      reasoning: area.reasoning
    }));

    // Sort by confidence (highest first)
    legalAreas.sort((a, b) => b.confidence - a.confidence);

    return {
      legalAreas,
      primaryArea: legalAreas[0].area, // Use highest confidence area
      summary: result.summary
    };

  } catch (error) {
    console.error('[AI Inference] LLM inference failed, falling back to keyword matching:', error);
    return inferLegalAreasKeywordBased(caseSummary);
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function inferLegalAreasWithAI(caseSummary: string): Promise<InferenceResult> {
  return inferLegalAreas(caseSummary);
}

