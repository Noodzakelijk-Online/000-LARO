/**
 * Data API Wrapper
 * Placeholder for external data service calls (LinkedIn, KvK enrichment, etc.)
 */
export async function callDataApi(endpoint: string, params: any) {
  console.log(`[DataAPI] Called ${endpoint} with:`, params);
  
  // Minimal stub for LinkedIn company details used in KvK integration
  if (endpoint === "LinkedIn/get_company_details") {
    return {
      success: false,
      message: "LinkedIn Data API not configured",
    };
  }
  
  return { success: false, message: "Endpoint not implemented" };
}
