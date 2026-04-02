/**
 * Geocoding Utility
 * Uses OpenStreetMap Nominatim API to convert addresses to coordinates
 * 
 * Rate Limit: 1 request per second (Nominatim usage policy)
 * Documentation: https://nominatim.org/release-docs/latest/api/Search/
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

interface GeocodingResult {
  latitude: number | null;
  longitude: number | null;
  formattedAddress?: string;
}

/**
 * Geocode a Dutch address using Nominatim
 */
export async function geocodeAddress(
  address: string,
  city: string,
  postalCode?: string
): Promise<GeocodingResult> {
  try {
    // Build search query
    const parts = [address, postalCode, city, "Netherlands"].filter(Boolean);
    const query = parts.join(", ");

    // Nominatim API endpoint
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "nl"); // Netherlands only

    console.log(`[GEOCODING] Geocoding: ${query}`);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Dutch-Lawyer-Automation-Dashboard/1.0", // Required by Nominatim
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.log(`[GEOCODING] No results found for: ${query}`);
      return { latitude: null, longitude: null };
    }

    const result = data[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

    console.log(`[GEOCODING] Found coordinates: ${latitude}, ${longitude}`);

    return {
      latitude,
      longitude,
      formattedAddress: result.display_name,
    };
  } catch (error) {
    console.error("[GEOCODING] Error geocoding address:", error);
    return { latitude: null, longitude: null };
  }
}

/**
 * Delay helper for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Geocode multiple addresses with rate limiting
 */
export async function geocodeAddressesBatch(
  addresses: Array<{ id: string; address: string; city: string; postalCode?: string }>,
  delayMs: number = 1000 // 1 second delay between requests
): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>();

  for (let i = 0; i < addresses.length; i++) {
    const item = addresses[i];
    
    console.log(`[GEOCODING] Processing ${i + 1}/${addresses.length}: ${item.city}`);
    
    const result = await geocodeAddress(item.address, item.city, item.postalCode);
    results.set(item.id, result);

    // Rate limiting: wait before next request (except for last item)
    if (i < addresses.length - 1) {
      await delay(delayMs);
    }
  }

  return results;
}

export const geocodingRouter = router({
  geocode: publicProcedure
    .input(
      z.object({
        address: z.string(),
        city: z.string(),
        postalCode: z.string().optional(),
      })
    )
    .query(async ({ input }) => geocodeAddress(input.address, input.city, input.postalCode)),

  batch: publicProcedure
    .input(
      z.object({
        addresses: z.array(
          z.object({
            id: z.string(),
            address: z.string(),
            city: z.string(),
            postalCode: z.string().optional(),
          })
        ),
        delayMs: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const map = await geocodeAddressesBatch(input.addresses, input.delayMs);
      return Object.fromEntries(map.entries());
    }),
});
