/**
 * Optimized Dutch Bar Association (NOvA) Scraper
 * 
 * Improvements over original:
 * - Checks for existing lawyers to avoid duplicates
 * - Resumes from last scraped page
 * - Better memory management (closes browser periodically)
 * - Periodic checkpointing to database
 * - Graceful error handling and recovery
 * - Progress tracking and logging
 */

import { chromium, Browser, Page } from 'playwright';
import { getDb } from './db';
import { lawyers } from './schema';
import { eq } from 'drizzle-orm';

export interface ScrapedLawyer {
  novaId: string;
  name: string;
  title: string;
  firmName: string;
  city: string;
  address?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  admissionDate?: string;
  courtDistrict?: string;
  legalAreas: string[];
  specializations: string[];
  acceptsLegalAid: boolean;
  profileUrl: string;
}

export interface ScraperProgress {
  lastPageScraped: number;
  totalLawyersScraped: number;
  startTime: Date;
  lastCheckpoint: Date;
  errors: number;
}

/**
 * Get existing NOvA IDs from database to avoid re-scraping
 */
async function getExistingNovaIds(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();

  try {
    const result = await db.execute('SELECT novaId FROM lawyers WHERE novaId IS NOT NULL');
    const ids = new Set<string>();
    for (const row of result[0] as any[]) {
      if (row.novaId) ids.add(row.novaId);
    }
    console.log(`[Scraper] Found ${ids.size} existing lawyers in database`);
    return ids;
  } catch (error) {
    console.error('[Scraper] Error fetching existing NOvA IDs:', error);
    return new Set();
  }
}

/**
 * Save lawyer to database immediately (checkpoint)
 */
async function saveLawyerToDb(lawyer: ScrapedLawyer): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Generate unique ID from NOvA ID
    const id = `lawyer_${lawyer.novaId}`;
    
    await db.insert(lawyers).values({
      id,
      name: lawyer.name,
      email: lawyer.email || null,
      phone: lawyer.phone || null,
      firmName: lawyer.firmName,
      address: lawyer.address || null,
      city: lawyer.city,
      postalCode: lawyer.postalCode || null,
      website: lawyer.website || null,
      legalAreas: JSON.stringify(lawyer.legalAreas), // JSON array
      experienceYears: lawyer.admissionDate ? String(new Date().getFullYear() - new Date(lawyer.admissionDate).getFullYear()) : null,
      latitude: null,
      longitude: null,
      novaId: lawyer.novaId,
      profileUrl: lawyer.profileUrl,
      courtDistrict: lawyer.courtDistrict || null,
      // LARO fields with defaults
      averageResponseTimeHours: '48',
      currentlyAccepting: 'Yes' as const,
      caseStop: 'No' as const,
      permanentlyFiltered: 'No' as const
    });
    return true;
  } catch (error: any) {
    // Ignore duplicate key errors
    if (error.message?.includes('Duplicate entry')) {
      return true;
    }
    console.error(`[Scraper] Error saving lawyer ${lawyer.name}:`, error);
    return false;
  }
}

/**
 * Extract lawyer data from a search result card
 */
async function extractLawyerFromCard(card: any): Promise<ScrapedLawyer | null> {
  try {
    const cardData = await card.evaluate((el: any) => {
      const nameLink = el.querySelector('a[href*="/advocaten/"]');
      const firmLink = el.querySelector('a[href*="/kantoren/"]');
      
      // Extract all text to find city
      const allText = el.textContent || '';
      
      // Extract legal areas from badges/buttons
      const badges = Array.from(el.querySelectorAll('button, [class*="badge"]')).map((b: any) => 
        b.textContent?.trim()
      ).filter((t: string) => t && t.length > 0);
      
      return {
        name: nameLink?.textContent?.trim() || '',
        profileUrl: nameLink?.getAttribute('href') || '',
        firmName: firmLink?.textContent?.trim() || '',
        allText,
        badges
      };
    });
    
    if (!cardData.name || !cardData.profileUrl) return null;

    // Extract NOvA ID from URL
    const idMatch = cardData.profileUrl.match(/\/(\d+)$/);
    const novaId = idMatch ? idMatch[1] : '';

    // Extract title
    const title = cardData.name.includes('mevrouw') ? 'mevrouw mr.' : 'mr.';

    // Extract city from text content (it appears in uppercase in the card)
    let city = '';
    const cityPatterns = [
      'AMSTERDAM', 'ROTTERDAM', 'DEN HAAG', "'S-GRAVENHAGE", 'UTRECHT', 'EINDHOVEN',
      'TILBURG', 'GRONINGEN', 'ALMERE', 'BREDA', 'NIJMEGEN', 'APELDOORN', 'HAARLEM',
      'ARNHEM', 'ENSCHEDE', 'ZAANSTAD', 'AMERSFOORT', 'MAASTRICHT', 'DORDRECHT',
      'LEIDEN', 'HAARLEMMERMEER', 'ZOETERMEER', 'ZWOLLE', 'EMMEN', 'DELFT', 'BARENDRECHT'
    ];
    
    for (const pattern of cityPatterns) {
      if (cardData.allText.includes(pattern)) {
        city = pattern;
        break;
      }
    }
    
    // Fallback: extract from URL
    if (!city && cardData.profileUrl) {
      const cityMatch = cardData.profileUrl.match(/\/advocaten\/([^\/]+)\//);
      if (cityMatch) {
        city = cityMatch[1].replace(/-/g, ' ');
        city = city.charAt(0).toUpperCase() + city.slice(1);
      }
    }

    // Extract legal areas from badges
    const legalAreas = cardData.badges
      .filter((area: string) => 
        area && 
        area !== 'Rechtsgebied(en)' && 
        area !== 'Specialisatievereniging(en)' &&
        area !== 'Niet bekend' && 
        area !== 'Geen' &&
        area.length > 2
      );

    return {
      novaId,
      name: cardData.name.replace(/^(mevrouw\s+)?mr\.\s+/i, ''),
      title,
      firmName: cardData.firmName || 'Unknown',
      city: city || 'Unknown',
      legalAreas: legalAreas.length > 0 ? legalAreas : ['General Practice'],
      specializations: [],
      acceptsLegalAid: false,
      profileUrl: cardData.profileUrl.startsWith('http') ? cardData.profileUrl : `https://zoekeenadvocaat.advocatenorde.nl${cardData.profileUrl}`
    };
  } catch (error) {
    console.error('[Scraper] Error extracting lawyer from card:', error);
    return null;
  }
}

/**
 * Optimized scraper with resume capability and duplicate checking
 */
export async function scrapeLayersOptimized(options: {
  startPage?: number;
  maxPages?: number;
  delayMs?: number;
  checkpointInterval?: number; // Save progress every N pages
  restartBrowserInterval?: number; // Restart browser every N pages to free memory
}): Promise<ScraperProgress> {
  const {
    startPage = 1,
    maxPages = 1500,
    delayMs = 2000,
    checkpointInterval = 10,
    restartBrowserInterval = 20 // Restart every 20 pages to prevent crashes
  } = options;

  const progress: ScraperProgress = {
    lastPageScraped: startPage - 1,
    totalLawyersScraped: 0,
    startTime: new Date(),
    lastCheckpoint: new Date(),
    errors: 0
  };

  // Get existing NOvA IDs to skip duplicates
  const existingIds = await getExistingNovaIds();
  console.log(`[Scraper] Starting from page ${startPage}, will skip ${existingIds.size} existing lawyers`);

  let browser: Browser | null = null;
  let page: Page | null = null;

  const baseUrl = 'https://zoekeenadvocaat.advocatenorde.nl/zoeken';
  const params = new URLSearchParams({
    type: 'advocaten',
    q: '',
    'locatie[adres]': '',
    'locatie[geo]': 'false',
    'locatie[hash]': '',
    'filters[rechtsgebieden]': '[]',
    'filters[specialisatieverenigingen]': '[]',
    'filters[toevoegingen]': '0',
  });
  const searchUrl = `${baseUrl}?${params.toString()}`;

  try {
    for (let pageNum = startPage; pageNum <= maxPages; pageNum++) {
      // Restart browser periodically to free memory
      const shouldRestart = !browser || !page || (pageNum > startPage && (pageNum - startPage) % restartBrowserInterval === 0);
      
      if (shouldRestart) {
        if (browser) {
          console.log('[Scraper] Restarting browser to free memory...');
          try {
            await browser.close();
          } catch (e) {
            console.log('[Scraper] Browser already closed');
          }
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s before restart
        }

        console.log('[Scraper] Launching browser...');
        browser = await chromium.launch({ 
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
            // Removed --single-process as it causes crashes
          ]
        });
        
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        page = await context.newPage();
      }

      console.log(`\n[Scraper] ========== PAGE ${pageNum}/${maxPages} ==========`);
      
      try {
        // Navigate to page
        const pageUrl = `${searchUrl}&pagina=${pageNum}`;
        await page.goto(pageUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
        
        // Wait for results to load properly
        try {
          await page.waitForSelector('.result.advocaten', { timeout: 10000 });
        } catch (e) {
          console.log('[Scraper] Timeout waiting for results, retrying...');
          await page.waitForTimeout(5000);
        }
        
        // Check if page has results - use correct selector for result cards
        let lawyerCards = await page.$$('.result.advocaten');
        
        // Retry once if no results found (might be loading issue)
        if (lawyerCards.length === 0) {
          console.log('[Scraper] No results on first check, waiting and retrying...');
          await page.waitForTimeout(5000);
          lawyerCards = await page.$$('.result.advocaten');
        }
        
        if (lawyerCards.length === 0) {
          console.log('[Scraper] No results found after retry, skipping page');
          continue; // Skip this page but don't stop scraping
        }

        console.log(`[Scraper] Found ${lawyerCards.length} lawyers on page ${pageNum}`);

        let newLawyers = 0;
        let skipped = 0;

        // Extract and save lawyers
        for (const card of lawyerCards) {
          try {
            const lawyer = await extractLawyerFromCard(card);
            
            if (!lawyer) continue;

            // Skip if already exists
            if (existingIds.has(lawyer.novaId)) {
              skipped++;
              continue;
            }

            // Save to database immediately
            const saved = await saveLawyerToDb(lawyer);
            if (saved) {
              newLawyers++;
              existingIds.add(lawyer.novaId); // Add to set to avoid re-processing
              progress.totalLawyersScraped++;
              
              if (newLawyers % 5 === 0) {
                console.log(`[Scraper] Saved ${newLawyers} new lawyers from page ${pageNum}...`);
              }
            }
          } catch (error) {
            console.error('[Scraper] Error processing lawyer:', error);
            progress.errors++;
          }
        }

        console.log(`[Scraper] Page ${pageNum} complete: ${newLawyers} new, ${skipped} skipped, ${progress.errors} errors`);
        
        progress.lastPageScraped = pageNum;

        // Checkpoint progress
        if (pageNum % checkpointInterval === 0) {
          progress.lastCheckpoint = new Date();
          const elapsed = (progress.lastCheckpoint.getTime() - progress.startTime.getTime()) / 1000;
          const rate = progress.totalLawyersScraped / (elapsed / 60);
          const remaining = maxPages - pageNum;
          const eta = remaining / (pageNum - startPage + 1) * elapsed;
          
          console.log(`\n[Scraper] ===== CHECKPOINT =====`);
          console.log(`[Scraper] Progress: ${pageNum}/${maxPages} pages (${Math.round(pageNum/maxPages*100)}%)`);
          console.log(`[Scraper] Total scraped: ${progress.totalLawyersScraped} lawyers`);
          console.log(`[Scraper] Rate: ${rate.toFixed(1)} lawyers/min`);
          console.log(`[Scraper] ETA: ${Math.round(eta/60)} minutes`);
          console.log(`[Scraper] Errors: ${progress.errors}`);
          console.log(`[Scraper] ====================\n`);
        }

        // Delay before next page
        await new Promise(resolve => setTimeout(resolve, delayMs));

      } catch (error: any) {
        console.error(`[Scraper] Error on page ${pageNum}:`, error);
        progress.errors++;
        
        // If browser crashed, restart it
        if (error.message?.includes('Target page, context or browser has been closed')) {
          console.log('[Scraper] Browser crashed, restarting...');
          browser = null;
          page = null;
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue; // Skip to next iteration which will restart browser
        }
        
        // If too many consecutive errors, take a longer break
        if (progress.errors % 5 === 0) {
          console.log('[Scraper] Multiple errors detected, taking 30s break...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }
    }

  } catch (error) {
    console.error('[Scraper] Fatal error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Final summary
  const duration = (new Date().getTime() - progress.startTime.getTime()) / 1000;
  console.log(`\n[Scraper] ===== FINAL SUMMARY =====`);
  console.log(`[Scraper] Pages scraped: ${progress.lastPageScraped - startPage + 1}`);
  console.log(`[Scraper] Total lawyers: ${progress.totalLawyersScraped}`);
  console.log(`[Scraper] Duration: ${Math.round(duration/60)} minutes`);
  console.log(`[Scraper] Average rate: ${(progress.totalLawyersScraped / (duration/60)).toFixed(1)} lawyers/min`);
  console.log(`[Scraper] Errors: ${progress.errors}`);
  console.log(`[Scraper] ========================\n`);

  return progress;
}

/**
 * Resume scraper from last checkpoint
 */
export async function resumeScraper(): Promise<ScraperProgress> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get last scraped page by checking max NOvA ID or using a progress table
  // For now, we'll estimate based on lawyer count
  const result = await db.execute('SELECT COUNT(*) as count FROM lawyers WHERE novaId IS NOT NULL');
  const count = (result[0] as any)[0].count;
  
  // Estimate: ~13 lawyers per page
  const estimatedLastPage = Math.floor(count / 13);
  const startPage = Math.max(1, estimatedLastPage - 5); // Go back 5 pages to be safe
  
  console.log(`[Scraper] Resuming from estimated page ${startPage} (${count} lawyers in DB)`);
  
  return scrapeLayersOptimized({
    startPage,
    maxPages: 1500,
    delayMs: 2000,
    checkpointInterval: 10,
    restartBrowserInterval: 20
  });
}

