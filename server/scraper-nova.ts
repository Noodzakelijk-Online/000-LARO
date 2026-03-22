/**
 * Dutch Bar Association (NOvA) Scraper
 * 
 * Scrapes lawyer data from https://zoekeenadvocaat.advocatenorde.nl/
 * 
 * ⚠️ IMPORTANT: This scraper should be used responsibly:
 * - Respect rate limits (1-2 requests per second)
 * - Run during off-peak hours
 * - Consider contacting NOvA for official data access first
 * - Cache results to minimize requests
 */

import { chromium, Browser, Page } from 'playwright';

export interface FirmDetails {
  name: string;
  size?: number; // Number of lawyers in firm
  address?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface ScrapedLawyer {
  novaId: string;
  name: string;
  title: string; // mr. or mevrouw mr.
  firmName: string;
  firmDetails?: FirmDetails; // Structured firm information
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

export interface ScraperOptions {
  maxPages?: number; // Maximum pages to scrape (default: 1)
  delayMs?: number; // Delay between requests in ms (default: 1000)
  headless?: boolean; // Run browser in headless mode (default: true)
  legalArea?: string; // Filter by legal area ID (e.g., '14' for Arbeidsrecht) (optional)
  city?: string; // Filter by city (optional)
  deepScrape?: boolean; // Visit individual profile pages for detailed info (default: false)
}

export interface ScraperStats {
  lawyersScraped: number;
  pagesProcessed: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

/**
 * Scrape lawyers from Dutch Bar Association website
 */
export async function scrapeLawyers(options: ScraperOptions = {}): Promise<{
  lawyers: ScrapedLawyer[];
  stats: ScraperStats;
}> {
  const {
    maxPages = 1,
    delayMs = 1000,
    headless = true,
    legalArea,
    city,
    deepScrape = false,
  } = options;

  const lawyers: ScrapedLawyer[] = [];
  const stats: ScraperStats = {
    lawyersScraped: 0,
    pagesProcessed: 0,
    errors: 0,
    startTime: new Date(),
  };

  let browser: Browser | null = null;

  try {
    // Launch browser
    console.log('[NOvA Scraper] Launching browser...');
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // Build search URL
    const baseUrl = 'https://zoekeenadvocaat.advocatenorde.nl/zoeken';
    const params = new URLSearchParams({
      type: 'advocaten',
      q: '',
      'locatie[adres]': city || '',
      'locatie[geo]': 'false',
      'locatie[hash]': '',
      'filters[rechtsgebieden]': legalArea ? `[${legalArea}]` : '[]',
      'filters[specialisatieverenigingen]': '[]',
      'filters[toevoegingen]': '0',
    });
    const searchUrl = `${baseUrl}?${params.toString()}`;

    console.log(`[NOvA Scraper] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for results to load
    try {
      await page.waitForSelector('body', { timeout: 10000 });
      await page.waitForTimeout(2000); // Give page time to render
    } catch (e) {
      console.log('[NOvA Scraper] Warning: Page load timeout, continuing anyway');
    }

    // Get total results (optional, don't fail if not found)
    let totalLawyers = 0;
    try {
      const totalText = await page.textContent('h2:has-text("advocaten gevonden")', { timeout: 5000 }) || '';
      const totalMatch = totalText.match(/(\d+)/);
      totalLawyers = totalMatch ? parseInt(totalMatch[1]) : 0;
      console.log(`[NOvA Scraper] Found ${totalLawyers} lawyers`);
    } catch (e) {
      console.log('[NOvA Scraper] Could not determine total count, continuing...');
    }

    // Scrape pages
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`[NOvA Scraper] Processing page ${pageNum}/${maxPages}...`);

      try {
        // Wait for page to be fully loaded and lawyer cards to appear
        try {
          await page.waitForSelector('.zoekresultaat-item, article', { timeout: 30000 });
          await page.waitForTimeout(2000); // Extra time for dynamic content
        } catch (error) {
          console.log('[NOvA Scraper] Timeout waiting for lawyer cards, trying anyway...');
        }   
        // Extract lawyer cards from current page - try multiple selectors
        let lawyerCards = await page.$$('.zoekresultaat-item');
        if (lawyerCards.length === 0) {
          lawyerCards = await page.$$('article');
        }
        if (lawyerCards.length === 0) {
          lawyerCards = await page.$$('[class*="result"]');
        }
        
        console.log(`[NOvA Scraper] Found ${lawyerCards.length} lawyer cards on page ${pageNum}`);
        
        if (lawyerCards.length === 0) {
          console.log('[NOvA Scraper] No lawyer cards found, page structure may have changed');
          console.log('[NOvA Scraper] Saving page screenshot for debugging...');
          await page.screenshot({ path: '/home/ubuntu/nova-scraper-debug.png' });
          break;
        }

        // First, extract all basic lawyer data from cards
        const pageLawyers: ScrapedLawyer[] = [];
        for (const card of lawyerCards) {
          try {
            const lawyerData = await extractLawyerFromCard(card);
            if (lawyerData) {
              pageLawyers.push(lawyerData);
            }
          } catch (error) {
            console.error('[NOvA Scraper] Error extracting lawyer:', error);
            stats.errors++;
          }
        }
        
        console.log(`[NOvA Scraper] Extracted ${pageLawyers.length} lawyers from page ${pageNum}`);
        
        // Then, if deep scrape is enabled, visit each profile page
        if (deepScrape) {
          console.log(`[NOvA Scraper] Starting deep scrape of ${pageLawyers.length} profiles...`);
          for (const lawyerData of pageLawyers) {
            try {
              console.log(`[NOvA Scraper] Deep scraping: ${lawyerData.name}`);
              const profileDetails = await scrapeLawyerProfileInternal(page, lawyerData.profileUrl, delayMs);
              Object.assign(lawyerData, profileDetails);
            } catch (profileError) {
              console.error(`[NOvA Scraper] Error scraping profile for ${lawyerData.name}:`, profileError);
              stats.errors++;
            }
          }
          console.log(`[NOvA Scraper] Deep scrape complete for page ${pageNum}`);
        }
        
        // Add all lawyers from this page to results
        lawyers.push(...pageLawyers);
        stats.lawyersScraped += pageLawyers.length;

        stats.pagesProcessed++;

        // Navigate to next page using URL parameter (more reliable than button clicking)
        if (pageNum < maxPages) {
          console.log(`[NOvA Scraper] Waiting ${delayMs}ms before next page...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          const nextPageUrl = `${searchUrl}&pagina=${pageNum + 1}`;
          console.log(`[NOvA Scraper] Navigating to page ${pageNum + 1}/${maxPages}: ${nextPageUrl}`);
          await page.goto(nextPageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(2000); // Give page time to render
        }
      } catch (error) {
        console.error(`[NOvA Scraper] Error processing page ${pageNum}:`, error);
        stats.errors++;
      }
    }

    await browser.close();
  } catch (error) {
    console.error('[NOvA Scraper] Fatal error:', error);
    if (browser) await browser.close();
    throw error;
  }

  stats.endTime = new Date();
  stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

  console.log('[NOvA Scraper] Scraping complete:', stats);

  return { lawyers, stats };
}

/**
 * Extract lawyer data from a search result card
 */
async function extractLawyerFromCard(card: any): Promise<ScrapedLawyer | null> {
  try {
    // Extract all data immediately to avoid stale element handles
    const cardData = await card.evaluate((el: any) => {
      const nameLink = el.querySelector('a[href*="/advocaten/"]');
      const firmLink = el.querySelector('a[href*="/kantoren/"]');
      
      return {
        name: nameLink?.textContent?.trim() || '',
        profileUrl: nameLink?.getAttribute('href') || '',
        firmName: firmLink?.textContent?.trim() || '',
      };
    });
    
    if (!cardData.name || !cardData.profileUrl) return null;

    // Extract NOvA ID from URL
    const idMatch = cardData.profileUrl.match(/\/(\d+)$/);
    const novaId = idMatch ? idMatch[1] : '';

    // Extract title (mr. or mevrouw mr.)
    const title = cardData.name.includes('mevrouw') ? 'mevrouw mr.' : 'mr.';

    // Extract city from profile URL
    let city = '';
    if (cardData.profileUrl) {
      const cityMatch = cardData.profileUrl.match(/\/advocaten\/([^\/]+)\//);
      if (cityMatch) {
        city = cityMatch[1].replace(/-/g, ' ');
        city = city.charAt(0).toUpperCase() + city.slice(1);
      }
    }

    // Extract legal areas - try multiple selectors
    let legalAreasText = '';
    const legalAreasElement = await card.$('.zoekresultaat-rechtsgebieden, [class*="rechtsgebied"], [class*="legal"]');
    if (legalAreasElement) {
      legalAreasText = (await legalAreasElement.textContent()) || '';
    }
    
    // Also try to get all text content and parse
    if (!legalAreasText) {
      const allText = await card.textContent();
      if (allText && allText.includes('Rechtsgebied')) {
        const match = allText.match(/Rechtsgebied\(en\)([\s\S]+?)(?:Specialisatie|$)/);
        if (match) legalAreasText = match[1];
      }
    }
    
    const legalAreas = legalAreasText
      .split('\n')
      .map((area: string) => area.trim())
      .filter((area: string) => area && area !== 'Rechtsgebied(en)' && area !== 'Niet bekend' && area.length > 2);

    // Extract specializations
    const specializationsElement = await card.$('.zoekresultaat-specialisaties');
    const specializationsText = specializationsElement ? await specializationsElement.textContent() : '';
    const specializations = specializationsText
      .split('\n')
      .map((spec: string) => spec.trim())
      .filter((spec: string) => spec && spec !== 'Specialisatievereniging(en)' && spec !== 'Geen' && spec !== 'Niet bekend');

    return {
      novaId,
      name: cardData.name,
      title,
      firmName: cardData.firmName,
      city: city,
      legalAreas,
      specializations,
      acceptsLegalAid: false, // Will be updated when visiting profile
      profileUrl: `https://zoekeenadvocaat.advocatenorde.nl${cardData.profileUrl}`,
    };
  } catch (error) {
    console.error('[NOvA Scraper] Error extracting lawyer from card:', error);
    return null;
  }
}

/**
 * Internal function to scrape profile using existing page (for batch scraping)
 */
async function scrapeLawyerProfileInternal(page: Page, profileUrl: string, delayMs: number): Promise<Partial<ScrapedLawyer>> {
  try {
    // Add delay before visiting profile
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000); // Give page time to render

    const details: Partial<ScrapedLawyer> = {};

    // Extract admission date
    const admissionDateElement = await page.$('text=/Beëdigingsdatum/');
    if (admissionDateElement) {
      const dateText = await admissionDateElement.evaluate((el: any) => el.parentElement?.textContent || '');
      const dateMatch = dateText?.match(/(\d{2}-\d{2}-\d{4})/);
      if (dateMatch) {
        details.admissionDate = dateMatch[1];
      }
    }

    // Extract court district
    const districtElement = await page.$('text=/Arrondissement/');
    if (districtElement) {
      const districtText = await districtElement.evaluate((el: any) => el.parentElement?.textContent || '');
      const districtMatch = districtText?.match(/Arrondissement\s+(.+)/);
      if (districtMatch) {
        details.courtDistrict = districtMatch[1].trim();
      }
    }

    // Extract contact information
    const phoneElement = await page.$('a[href^="tel:"]');
    if (phoneElement) {
      const phoneText = await phoneElement.textContent();
      if (phoneText) details.phone = phoneText;
    }

    const emailElement = await page.$('a[href^="mailto:"]');
    if (emailElement) {
      const emailText = await emailElement.textContent();
      if (emailText) details.email = emailText;
    }

    const websiteElement = await page.$('a[href^="http"]:not([href*="advocatenorde.nl"])');
    if (websiteElement) {
      const websiteUrl = await websiteElement.getAttribute('href');
      if (websiteUrl) details.website = websiteUrl;
    }

    // Extract address
    const addressElement = await page.$('.kantoor-adres');
    if (addressElement) {
      const addressText = await addressElement.textContent();
      const lines = addressText?.split('\n').map(l => l.trim()).filter(l => l);
      if (lines && lines.length >= 2) {
        details.address = lines[0];
        const postalMatch = lines[1].match(/(\d{4}\s*[A-Z]{2})/);
        if (postalMatch) {
          details.postalCode = postalMatch[1];
        }
      }
    }

    // Extract legal areas from profile page
    try {
      // Wait for the profile content to load
      await page.waitForSelector('text=/RECHTSGEBIED/', { timeout: 5000 }).catch(() => null);
      
      // Get all text content from the page
      const pageText = await page.textContent('body') || '';
      
      // Extract legal areas section
      const legalAreasMatch = pageText.match(/RECHTSGEBIED\(EN\)([\s\S]+?)(?:SPECIALISATIEVERENIGING|AANVULLENDE|$)/i);
      if (legalAreasMatch) {
        const areasText = legalAreasMatch[1];
        // Split by newlines and clean up
        const areas = areasText
          .split('\n')
          .map(a => a.trim())
          .filter(a => {
            return a.length > 2 && 
                   !a.toLowerCase().includes('niet bekend') &&
                   !a.toLowerCase().includes('rechtsgebied') &&
                   !/^[\d\s]+$/.test(a) &&
                   a !== '*' &&
                   a !== '-';
          });
        
        if (areas.length > 0 && !areas.every(a => a.toLowerCase() === 'niet bekend')) {
          details.legalAreas = areas;
        }
      }
    } catch (e) {
      console.log('[NOvA Scraper] Could not extract legal areas:', e);
    }
    
    // Extract specializations from profile page
    try {
      const pageText = await page.textContent('body') || '';
      
      // Extract specializations section
      const specsMatch = pageText.match(/SPECIALISATIEVERENIGING\(EN\)([\s\S]+?)(?:AANVULLENDE|$)/i);
      if (specsMatch) {
        const specsText = specsMatch[1];
        // Split by newlines and clean up
        const specs = specsText
          .split('\n')
          .map(s => s.trim())
          .filter(s => {
            return s.length > 5 && 
                   !s.toLowerCase().includes('niet bekend') &&
                   !s.toLowerCase().includes('geen') &&
                   !s.toLowerCase().includes('specialisatie') &&
                   !/^[\d\s]+$/.test(s) &&
                   !s.includes('©') &&
                   !s.includes('http') &&
                   s !== '*' &&
                   s !== '-';
          });
        
        if (specs.length > 0 && !specs.every(s => s.toLowerCase() === 'niet bekend' || s.toLowerCase() === 'geen')) {
          details.specializations = specs;
        }
      }
    } catch (e) {
      console.log('[NOvA Scraper] Could not extract specializations:', e);
    }

    // Check if accepts legal aid
    const legalAidElement = await page.$('text=/gefinancierde rechtsbijstand/');
    details.acceptsLegalAid = !!legalAidElement;

    // Extract firm details
    try {
(Content truncated due to size limit. Use page ranges or line ranges to read remaining content)