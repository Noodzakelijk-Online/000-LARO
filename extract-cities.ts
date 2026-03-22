/**
 * Extract City Data from Existing Lawyers
 * 
 * Parses city information from lawyer addresses and website URLs
 * to populate the new city column in the database.
 * 
 * Usage:
 *   pnpm tsx server/scripts/extract-cities.ts [--dry-run]
 */

import { getDb } from "../db";
import { lawyers } from "../../drizzle/schema";
import { eq, isNull, or } from "drizzle-orm";

interface CityExtractionResult {
  lawyerId: string;
  lawyerName: string;
  extractedCity: string | null;
  source: "address" | "website" | "none";
}

/**
 * Extract city from address string
 * Common patterns in Dutch addresses:
 * - "Street 123, 1234 AB Amsterdam"
 * - "1234 AB Amsterdam"
 * - "Amsterdam, Netherlands"
 */
function extractCityFromAddress(address: string): string | null {
  if (!address) return null;

  // Pattern 1: Postal code followed by city name
  // Example: "1234 AB Amsterdam" or "1234AB Amsterdam"
  const postalCodePattern = /\d{4}\s*[A-Z]{2}\s+([A-Z][a-zA-Z\s-]+?)(?:\s*,|\s*$|Nederland)/i;
  let match = address.match(postalCodePattern);
  if (match) {
    return match[1].trim();
  }

  // Pattern 2: City name before "Nederland" or "Netherlands"
  const beforeNederlandPattern = /,\s*([A-Z][a-zA-Z\s-]+?)\s*,?\s*Nederland/i;
  match = address.match(beforeNederlandPattern);
  if (match) {
    return match[1].trim();
  }

  // Pattern 3: Last capitalized word(s) before end
  const lastCapitalizedPattern = /([A-Z][a-zA-Z\s-]+?)(?:\s*,|\s*$)/;
  match = address.match(lastCapitalizedPattern);
  if (match) {
    const city = match[1].trim();
    // Filter out common non-city words
    if (!['Nederland', 'Netherlands', 'Postbus', 'PO Box'].includes(city)) {
      return city;
    }
  }

  return null;
}

/**
 * Extract city from website URL
 * NOvA profile URLs have format: /advocaten/{city}/{name}/{id}
 */
function extractCityFromWebsite(website: string): string | null {
  if (!website) return null;

  // Pattern: /advocaten/{city}/{name}/{id}
  const cityPattern = /\/advocaten\/([^\/]+)\//;
  const match = website.match(cityPattern);
  
  if (match) {
    let city = match[1];
    // Convert URL slug to proper city name
    // Example: "den-haag" -> "Den Haag"
    city = city.replace(/-/g, ' ');
    city = city.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    return city;
  }

  return null;
}

async function extractCities(dryRun: boolean = false) {
  console.log("\n🏙️  City Extraction Script");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will update database)"}`);
  console.log("=".repeat(50) + "\n");

  const db = await getDb();
  if (!db) {
    console.error("❌ Database not available");
    process.exit(1);
  }

  try {
    // Get all lawyers without city data
    const lawyersToProcess = await db.select()
      .from(lawyers)
      .where(or(
        isNull(lawyers.city),
        eq(lawyers.city, ""),
        eq(lawyers.city, "Unknown")
      ));

    console.log(`📍 Found ${lawyersToProcess.length} lawyers without city data\n`);

    if (lawyersToProcess.length === 0) {
      console.log("✅ All lawyers already have city data!");
      process.exit(0);
    }

    const results: CityExtractionResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < lawyersToProcess.length; i++) {
      const lawyer = lawyersToProcess[i];
      
      console.log(`[${i + 1}/${lawyersToProcess.length}] ${lawyer.name}`);

      let extractedCity: string | null = null;
      let source: "address" | "website" | "none" = "none";

      // Try extracting from address first
      if (lawyer.address) {
        extractedCity = extractCityFromAddress(lawyer.address);
        if (extractedCity) {
          source = "address";
          console.log(`  ✓ From address: ${extractedCity}`);
        }
      }

      // If no city from address, try website
      if (!extractedCity && lawyer.website) {
        extractedCity = extractCityFromWebsite(lawyer.website);
        if (extractedCity) {
          source = "website";
          console.log(`  ✓ From website: ${extractedCity}`);
        }
      }

      if (extractedCity) {
        successCount++;
        
        // Update database (unless dry run)
        if (!dryRun) {
          await db.update(lawyers)
            .set({ city: extractedCity })
            .where(eq(lawyers.id, lawyer.id));
        }
      } else {
        failedCount++;
        console.log(`  ✗ Could not extract city`);
      }

      results.push({
        lawyerId: lawyer.id,
        lawyerName: lawyer.name,
        extractedCity,
        source,
      });

      // Progress update every 50 lawyers
      if ((i + 1) % 50 === 0) {
        console.log(`\n📊 Progress: ${i + 1}/${lawyersToProcess.length}`);
        console.log(`   Success: ${successCount} | Failed: ${failedCount}\n`);
      }
    }

    // Final statistics
    console.log("\n" + "=".repeat(50));
    console.log("🎉 City Extraction Complete!");
    console.log("=".repeat(50));
    console.log(`📊 Statistics:`);
    console.log(`   Total lawyers processed: ${lawyersToProcess.length}`);
    console.log(`   Successfully extracted: ${successCount}`);
    console.log(`   Failed to extract: ${failedCount}`);
    console.log(`   Success rate: ${Math.round(successCount / lawyersToProcess.length * 100)}%`);
    console.log(`\n   Sources:`);
    console.log(`   - From address: ${results.filter(r => r.source === "address").length}`);
    console.log(`   - From website: ${results.filter(r => r.source === "website").length}`);
    
    if (dryRun) {
      console.log(`\n⚠️  DRY RUN - No changes were made to the database`);
      console.log(`   Run without --dry-run to apply changes`);
    } else {
      console.log(`\n✅ Database updated successfully!`);
    }
    
    console.log("=".repeat(50) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during city extraction:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const dryRun = process.argv.includes("--dry-run");

extractCities(dryRun);

