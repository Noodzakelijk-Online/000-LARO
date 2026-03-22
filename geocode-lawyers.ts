/**
 * Geocode All Lawyers Script
 * 
 * Adds latitude/longitude coordinates to all lawyers in the database
 * Uses OpenStreetMap Nominatim API with rate limiting (1 req/sec)
 * 
 * Usage:
 *   pnpm tsx server/scripts/geocode-lawyers.ts [--limit N] [--delay MS]
 * 
 * Options:
 *   --limit N    Process only first N lawyers (default: all)
 *   --delay MS   Delay between requests in milliseconds (default: 1000)
 *   --force      Re-geocode lawyers that already have coordinates
 */

import { getDb } from "../db";
import { lawyers } from "../../drizzle/schema";
import { eq, isNull, or } from "drizzle-orm";
import { geocodeAddress, delay } from "../geocoding";

interface Stats {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
}

async function geocodeLawyers() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf("--limit");
  const delayIndex = args.indexOf("--delay");
  const force = args.includes("--force");

  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : undefined;
  const delayMs = delayIndex >= 0 ? parseInt(args[delayIndex + 1]) : 1000;

  console.log("\n🌍 Lawyer Geocoding Script");
  console.log("=".repeat(50));
  console.log(`Settings:`);
  console.log(`  Limit: ${limit || "all"}`);
  console.log(`  Delay: ${delayMs}ms`);
  console.log(`  Force re-geocode: ${force ? "Yes" : "No"}`);
  console.log("=".repeat(50) + "\n");

  const db = await getDb();
  if (!db) {
    console.error("❌ Database not available");
    process.exit(1);
  }

  const stats: Stats = {
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // Get lawyers that need geocoding
    let query = db.select().from(lawyers);

    if (!force) {
      // Only geocode lawyers without coordinates
      query = query.where(or(
        isNull(lawyers.latitude),
        isNull(lawyers.longitude)
      )) as any;
    }

    if (limit) {
      query = query.limit(limit) as any;
    }

    const lawyersToGeocode = await query;

    stats.total = lawyersToGeocode.length;

    if (stats.total === 0) {
      console.log("✅ All lawyers already have coordinates!");
      process.exit(0);
    }

    console.log(`📍 Found ${stats.total} lawyers to geocode\n`);

    const startTime = Date.now();

    for (let i = 0; i < lawyersToGeocode.length; i++) {
      const lawyer = lawyersToGeocode[i];
      stats.processed++;

      console.log(`\n[${stats.processed}/${stats.total}] ${lawyer.name}`);
      console.log(`  City: ${lawyer.city || "Unknown"}`);
      console.log(`  Address: ${lawyer.address || "N/A"}`);

      // Skip if no city
      if (!lawyer.city) {
        console.log(`  ⚠️  Skipped: No city information`);
        stats.skipped++;
        continue;
      }

      // Geocode the address
      const result = await geocodeAddress(
        lawyer.address || "",
        lawyer.city,
        lawyer.postalCode || undefined
      );

      if (result.latitude && result.longitude) {
        // Update lawyer with coordinates
        await db.update(lawyers)
          .set({
            latitude: result.latitude.toString(),
            longitude: result.longitude.toString(),
          })
          .where(eq(lawyers.id, lawyer.id));

        console.log(`  ✅ Success: ${result.latitude}, ${result.longitude}`);
        stats.success++;
      } else {
        console.log(`  ❌ Failed: Could not geocode address`);
        stats.failed++;
      }

      // Rate limiting: wait before next request (except for last item)
      if (i < lawyersToGeocode.length - 1) {
        await delay(delayMs);
      }

      // Progress update every 10 lawyers
      if (stats.processed % 10 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = stats.processed / elapsed;
        const remaining = stats.total - stats.processed;
        const eta = remaining / rate;

        console.log(`\n📊 Progress: ${stats.processed}/${stats.total} (${Math.round(stats.processed / stats.total * 100)}%)`);
        console.log(`   Success: ${stats.success} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`);
        console.log(`   ETA: ${Math.round(eta / 60)} minutes\n`);
      }
    }

    // Final statistics
    const totalTime = (Date.now() - startTime) / 1000;

    console.log("\n" + "=".repeat(50));
    console.log("🎉 Geocoding Complete!");
    console.log("=".repeat(50));
    console.log(`📊 Statistics:`);
    console.log(`   Total lawyers: ${stats.total}`);
    console.log(`   Successfully geocoded: ${stats.success}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Skipped: ${stats.skipped}`);
    console.log(`   Success rate: ${Math.round(stats.success / stats.total * 100)}%`);
    console.log(`   Total time: ${Math.round(totalTime / 60)} minutes`);
    console.log("=".repeat(50) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during geocoding:", error);
    process.exit(1);
  }
}

geocodeLawyers();

