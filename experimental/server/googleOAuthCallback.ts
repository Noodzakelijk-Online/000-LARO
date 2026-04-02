import { Router } from 'express';
import {
  exchangeCodeForTokens,
  getAccountInfo,
  saveEmailAccount,
} from './oauth2';

const router = Router();

/**
 * Google OAuth callback endpoint
 * Receives authorization code from Google and exchanges it for access token
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Check for errors from Google
    if (error) {
      console.error('Google OAuth error:', error);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Connection Failed</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 400px;
            }
            .error-icon {
              font-size: 64px;
              color: #f44336;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
            }
            p {
              color: #666;
              margin-bottom: 30px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✕</div>
            <h1>Connection Failed</h1>
            <p>Error: ${error}</p>
            <p>Please try again or contact support.</p>
          </div>
        </body>
        </html>
      `);
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }

    // Decode state to get userId and provider
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { userId, provider } = stateData;

    if (!userId || provider !== 'gmail') {
      return res.status(400).send('Invalid state parameter');
    }

    console.log(`[OAuth2] Google callback for user ${userId}`);

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens('gmail', code as string);

    // Get account info
    const accountInfo = await getAccountInfo('gmail', tokens.accessToken);

    // Save to database
    await saveEmailAccount(userId, 'gmail', tokens, accountInfo);

    // Return success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail Connected</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
          }
          .success-icon {
            font-size: 64px;
            color: #4CAF50;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
          }
          p {
            color: #666;
            margin-bottom: 30px;
          }
          button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
          }
          button:hover {
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>Gmail Connected!</h1>
          <p>Your Gmail account <strong>${accountInfo.email}</strong> has been successfully connected.</p>
          <button onclick="window.close()">Close Window</button>
        </div>
        <script>
          // Auto-close after 2 seconds
          setTimeout(() => {
            window.close();
          }, 2000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connection Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
          }
          .error-icon {
            font-size: 64px;
            color: #f44336;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
          }
          p {
            color: #666;
            margin-bottom: 30px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">✕</div>
          <h1>Connection Error</h1>
          <p>${error instanceof Error ? error.message : 'An error occurred during OAuth callback'}</p>
          <p>Please try again or contact support.</p>
        </div>
      </body>
      </html>
    `);
  }
});

export default router;
