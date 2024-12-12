import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return;
  }
  console.warn(warning.name, warning.message);
});

const app = express();
const PORT = 3000;

// Initialize OAuth client
const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `http://localhost:${PORT}/oauth2callback`
});

// Generate auth URL
const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

app.get('/', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    include_granted_scopes: true,
  });
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code as string;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      console.error('No refresh token received');
      res.redirect('/');
      return;
    }

    const tokenData = {
      ...tokens,
      expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000 // Default 1 hour expiry
    };

    oauth2Client.setCredentials(tokenData);

    // Save tokens to a file
    const tokenPath = path.join(process.cwd(), '.calendar-tokens.json');
    await fs.writeFile(tokenPath, JSON.stringify(tokenData, null, 2));

    res.send('Authentication successful! You can close this window.');
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).send('Authentication failed!');
  }
});

app.listen(PORT, () => {
  console.error(`Auth server running at http://localhost:${PORT}`);
}); 