/**
 * Data Export Utilities
 * 
 * Functions for exporting case data, lawyer information, and reports
 * in various formats (CSV, JSON, PDF)
 */

export interface ExportOptions {
  filename?: string;
  format: "csv" | "json" | "pdf";
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: any[], headers?: string[]): string {
  if (data.length === 0) return "";

  // Use provided headers or extract from first object
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Create header row
  const headerRow = csvHeaders.join(",");
  
  // Create data rows
  const dataRows = data.map(item => {
    return csvHeaders.map(header => {
      const value = item[header];
      
      // Handle different data types
      if (value === null || value === undefined) return "";
      if (typeof value === "object") return JSON.stringify(value);
      if (typeof value === "string" && value.includes(",")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(",");
  });
  
  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download data as file
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export cases to CSV
 */
export function exportCasesToCSV(cases: any[], filename?: string) {
  const csvData = cases.map(c => ({
    "Case ID": c.id,
    "Client Name": c.clientName,
    "Email": c.clientEmail,
    "Phone": c.clientPhone || "",
    "Case Type": c.caseType,
    "Status": c.status,
    "Urgency": c.urgency,
    "Created At": new Date(c.createdAt).toLocaleString(),
    "Summary": c.summary,
  }));
  
  const csv = convertToCSV(csvData);
  const fname = filename || `cases-export-${new Date().toISOString().split("T")[0]}.csv`;
  downloadFile(csv, fname, "text/csv");
}

/**
 * Export cases to JSON
 */
export function exportCasesToJSON(cases: any[], filename?: string) {
  const json = JSON.stringify(cases, null, 2);
  const fname = filename || `cases-export-${new Date().toISOString().split("T")[0]}.json`;
  downloadFile(json, fname, "application/json");
}

/**
 * Export lawyers to CSV
 */
export function exportLawyersToCSV(lawyers: any[], filename?: string) {
  const csvData = lawyers.map(l => ({
    "Lawyer ID": l.id,
    "Name": l.name,
    "Email": l.email,
    "Phone": l.phone || "",
    "Firm": l.firm || "",
    "City": l.city,
    "Postal Code": l.postalCode,
    "Legal Areas": Array.isArray(l.legalAreas) ? l.legalAreas.join("; ") : l.legalAreas,
    "Response Rate": l.responseRate ? `${(l.responseRate * 100).toFixed(1)}%` : "N/A",
    "Acceptance Rate": l.acceptanceRate ? `${(l.acceptanceRate * 100).toFixed(1)}%` : "N/A",
  }));
  
  const csv = convertToCSV(csvData);
  const fname = filename || `lawyers-export-${new Date().toISOString().split("T")[0]}.csv`;
  downloadFile(csv, fname, "text/csv");
}

/**
 * Export lawyers to JSON
 */
export function exportLawyersToJSON(lawyers: any[], filename?: string) {
  const json = JSON.stringify(lawyers, null, 2);
  const fname = filename || `lawyers-export-${new Date().toISOString().split("T")[0]}.json`;
  downloadFile(json, fname, "application/json");
}

/**
 * Export outreach history to CSV
 */
export function exportOutreachToCSV(outreach: any[], filename?: string) {
  const csvData = outreach.map(o => ({
    "Outreach ID": o.id,
    "Case ID": o.caseId,
    "Lawyer Name": o.lawyerName,
    "Lawyer Email": o.lawyerEmail,
    "Status": o.status,
    "Initial Contact": new Date(o.initialContact).toLocaleString(),
    "Last Contact": o.lastContact ? new Date(o.lastContact).toLocaleString() : "",
    "Follow-ups Sent": o.followUpsSent,
    "Distance (km)": o.distanceKm,
    "Response": o.response || "",
  }));
  
  const csv = convertToCSV(csvData);
  const fname = filename || `outreach-export-${new Date().toISOString().split("T")[0]}.csv`;
  downloadFile(csv, fname, "text/csv");
}

/**
 * Generate case summary report
 */
export function generateCaseSummaryReport(caseData: any): string {
  const report = `
CASE SUMMARY REPORT
Generated: ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name:           ${caseData.clientName}
Email:          ${caseData.clientEmail}
Phone:          ${caseData.clientPhone || "N/A"}

CASE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Case ID:        ${caseData.id}
Type:           ${caseData.caseType}
Status:         ${caseData.status}
Urgency:        ${caseData.urgency}
Created:        ${new Date(caseData.createdAt).toLocaleString()}

Legal Areas:    ${Array.isArray(caseData.legalAreas) 
  ? caseData.legalAreas.join(", ") 
  : caseData.legalAreas || "N/A"}

SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${caseData.summary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This report was generated by LARO - Lawyer Automation & Recommendation Optimizer
  `.trim();
  
  return report;
}

/**
 * Export case summary report as text file
 */
export function exportCaseSummary(caseData: any, filename?: string) {
  const report = generateCaseSummaryReport(caseData);
  const fname = filename || `case-${caseData.id}-summary-${new Date().toISOString().split("T")[0]}.txt`;
  downloadFile(report, fname, "text/plain");
}

/**
 * Print case summary
 */
export function printCaseSummary(caseData: any) {
  const report = generateCaseSummaryReport(caseData);
  const printWindow = window.open("", "_blank");
  
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Case Summary - ${caseData.id}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          <pre>${report}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
}

