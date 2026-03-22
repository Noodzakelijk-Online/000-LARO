import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { getGoogleAuthUrl } from '../googleOAuthService';

export const googleOAuthRouter = router({
  /**
   * Get Google OAuth authorization URL
   */
  getAuthUrl: publicProcedure.query(async () => {
    try {
      const redirectUri = `${process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3000'}/api/oauth/google/callback`;
      const authUrl = getGoogleAuthUrl(redirectUri);

      return {
        success: true,
        authUrl,
      };
    } catch (error) {
      console.error('Error getting Google auth URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get auth URL',
      };
    }
  }),

  /**
   * Get connected Google accounts for current user
   */
  getConnectedAccounts: protectedProcedure.query(async ({ ctx }) => {
    return [];
  }),
});