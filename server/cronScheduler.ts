import cron from 'node-cron';
import { runAutoCollectionForAllCases } from './autoCollectionService';
// Import outreach scheduler logic as it is added.

export function initCronScheduler() {
  console.log('[Cron] Initializing scheduled tasks...');

  // Run auto-collection every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Running daily auto-collection job at 2:00 AM');
    try {
      await runAutoCollectionForAllCases();
    } catch (error) {
      console.error('[Cron] Error in daily auto-collection job:', error);
    }
  });

  // Example placeholder for outreach processing
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Checking outreach status (hourly)...');
    // await processOutreachFollowups();
  });

  console.log('[Cron] Scheduled tasks loaded.');
}
