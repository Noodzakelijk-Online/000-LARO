/**
 * LARO Email Templates for Lawyer Outreach Automation
 * 15-Day Follow-up System
 */

export interface EmailTemplateData {
  lawyerName: string;
  caseId: string;
  clientName: string;
  caseType: string;
  caseSummary: string;
  urgency: string;
  legalAreas?: string[];
  evidenceCount?: number;
  timelineEventsCount?: number;
}

/**
 * Day 0: Initial Outreach Email
 * Purpose: Introduce the case and gauge lawyer interest
 */
export function getInitialOutreachTemplate(data: EmailTemplateData): { subject: string; body: string } {
  const { lawyerName, caseId, clientName, caseType, caseSummary, urgency, legalAreas } = data;
  
  return {
    subject: `Nieuwe cliënt zoekt advocaat - ${caseType} (${urgency} prioriteit)`,
    body: `
Beste ${lawyerName},

Via LARO (Lawyer Automation & Routing Online) hebben wij een nieuwe cliënt die juridische bijstand zoekt in uw rechtsgebied.

**Zaak Details:**
- Zaak ID: ${caseId}
- Cliënt: ${clientName}
- Rechtsgebied: ${caseType}
${legalAreas && legalAreas.length > 1 ? `- Gerelateerde gebieden: ${legalAreas.join(', ')}` : ''}
- Urgentie: ${urgency}

**Samenvatting van de zaak:**
${caseSummary}

**Wij vragen u:**
1. Bent u geïnteresseerd in deze zaak?
2. Hoeveel actieve zaken heeft u momenteel? (Dit helpt ons om toekomstige matches beter te maken)

U kunt reageren door simpelweg op deze email te antwoorden met "Geïnteresseerd" of "Niet beschikbaar".

Als wij binnen 5 dagen niets van u horen, sturen wij een vriendelijke herinnering.

**Waarom LARO?**
LARO verbindt burgers met gekwalificeerde advocaten op basis van specialisatie, beschikbaarheid en nabijheid. Ons doel is om juridische hulp toegankelijker te maken voor iedereen.

Met vriendelijke groet,

LARO Automatiseringssysteem
Namens ${clientName}

---
*Deze email is automatisch gegenereerd. Voor vragen kunt u contact opnemen via info@laro.nl*
    `.trim()
  };
}

/**
 * Day 5: First Follow-up (Friendly Reminder)
 * Purpose: Gentle reminder without pressure
 */
export function getFollowUp1Template(data: EmailTemplateData): { subject: string; body: string } {
  const { lawyerName, caseId, clientName, caseType } = data;
  
  return {
    subject: `Herinnering: Cliënt zoekt advocaat - ${caseType} (Zaak ${caseId})`,
    body: `
Beste ${lawyerName},

Dit is een vriendelijke herinnering over de zaak die wij 5 dagen geleden met u deelden.

**Zaak Details:**
- Zaak ID: ${caseId}
- Cliënt: ${clientName}
- Rechtsgebied: ${caseType}

Wij begrijpen dat u het druk heeft. Als u geïnteresseerd bent in deze zaak, laat het ons dan weten door te reageren op deze email.

Als u momenteel geen capaciteit heeft, is dat geen probleem - een kort bericht volstaat zodat wij verder kunnen met andere advocaten.

Wij sturen over 5 dagen een laatste herinnering als wij niets van u horen.

Met vriendelijke groet,

LARO Automatiseringssysteem
Namens ${clientName}

---
*Deze email is automatisch gegenereerd. Voor vragen kunt u contact opnemen via info@laro.nl*
    `.trim()
  };
}

/**
 * Day 10: Second Follow-up (Final Reminder)
 * Purpose: Last attempt with slightly more urgent tone
 */
export function getFollowUp2Template(data: EmailTemplateData): { subject: string; body: string } {
  const { lawyerName, caseId, clientName, caseType, urgency } = data;
  
  return {
    subject: `LAATSTE HERINNERING: Cliënt zoekt advocaat - ${caseType} (${urgency})`,
    body: `
Beste ${lawyerName},

Dit is onze laatste herinnering over zaak ${caseId} voor cliënt ${clientName}.

**Zaak Details:**
- Zaak ID: ${caseId}
- Cliënt: ${clientName}
- Rechtsgebied: ${caseType}
- Urgentie: ${urgency}

${urgency === 'High' ? '⚠️ Deze zaak heeft hoge prioriteit en de cliënt heeft dringend juridische bijstand nodig.\n\n' : ''}

**Dit is uw laatste kans om te reageren.**

Als wij binnen 5 dagen niets van u horen, gaan wij ervan uit dat u niet beschikbaar bent en zullen wij contact opnemen met andere advocaten.

Een simpel "Ja" of "Nee" volstaat.

Met vriendelijke groet,

LARO Automatiseringssysteem
Namens ${clientName}

---
*Deze email is automatisch gegenereerd. Voor vragen kunt u contact opnemen via info@laro.nl*
    `.trim()
  };
}

/**
 * Case-load Question Template (Optional standalone)
 * Purpose: Ask about lawyer capacity for better future matching
 */
export function getCaseLoadQuestionTemplate(lawyerName: string): { subject: string; body: string } {
  return {
    subject: `LARO: Korte vraag over uw huidige caseload`,
    body: `
Beste ${lawyerName},

Om onze matching algoritme te verbeteren en u alleen relevante zaken toe te sturen, willen wij graag weten:

**Hoeveel actieve zaken heeft u momenteel?**

Deze informatie helpt ons om:
- U niet te overspoelen met te veel aanvragen
- Betere matches te maken op basis van uw beschikbaarheid
- Cliënten sneller te verbinden met beschikbare advocaten

U kunt simpelweg reageren met een getal (bijv. "12 actieve zaken").

Bedankt voor uw medewerking!

Met vriendelijke groet,

LARO Team

---
*Deze email is automatisch gegenereerd. Voor vragen kunt u contact opnemen via info@laro.nl*
    `.trim()
  };
}

/**
 * No Response Notification (Internal - to case owner)
 * Purpose: Inform citizen that lawyer didn't respond
 */
export function getNoResponseNotification(data: EmailTemplateData & { lawyerEmail: string }): { subject: string; body: string } {
  const { clientName, lawyerName, caseId, caseType } = data;
  
  return {
    subject: `Update: Advocaat heeft niet gereageerd op uw zaak`,
    body: `
Beste ${clientName},

Wij hebben u op de hoogte willen stellen over de voortgang van uw zaak (${caseId} - ${caseType}).

**Status Update:**
Advocaat ${lawyerName} heeft helaas niet gereageerd op onze drie contactpogingen (dag 0, dag 5, dag 10).

**Wat doen wij nu?**
- Wij nemen automatisch contact op met de volgende beschikbare advocaat in uw gebied
- U hoeft niets te doen - wij blijven werken aan het vinden van de juiste advocaat voor u
- U ontvangt een melding zodra een advocaat interesse toont

**Uw zaak blijft actief** en wij blijven zoeken naar de beste match voor u.

Met vriendelijke groet,

LARO Team

---
*Voor vragen kunt u inloggen op uw LARO dashboard of contact opnemen via info@laro.nl*
    `.trim()
  };
}

/**
 * Lawyer Interested Notification (to case owner)
 * Purpose: Inform citizen that a lawyer is interested
 */
export function getLawyerInterestedNotification(data: EmailTemplateData & { lawyerEmail: string; lawyerPhone?: string }): { subject: string; body: string } {
  const { clientName, lawyerName, caseId, caseType, lawyerEmail, lawyerPhone } = data;
  
  return {
    subject: `🎉 Goed nieuws! Advocaat is geïnteresseerd in uw zaak`,
    body: `
Beste ${clientName},

Geweldig nieuws! Een advocaat heeft interesse getoond in uw zaak.

**Advocaat Details:**
- Naam: ${lawyerName}
- Rechtsgebied: ${caseType}
- Email: ${lawyerEmail}
${lawyerPhone ? `- Telefoon: ${lawyerPhone}` : ''}

**Volgende stappen:**
1. Log in op uw LARO dashboard om meer details te bekijken
2. U kunt direct contact opnemen met de advocaat via bovenstaande gegevens
3. Plan een kennismakingsgesprek om uw zaak te bespreken

**Uw zaak:** ${caseId} - ${caseType}

Wij wensen u veel succes met uw juridische zaak!

Met vriendelijke groet,

LARO Team

---
*Voor vragen kunt u inloggen op uw LARO dashboard of contact opnemen via info@laro.nl*
    `.trim()
  };
}

