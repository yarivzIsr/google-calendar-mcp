import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

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
      res.redirect('/');
      return;
    }

    oauth2Client.setCredentials(tokens);

    // Save tokens to a file
    const tokenPath = path.join(process.cwd(), '.calendar-tokens.json');
    await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));

    res.send('Authentication successful! You can close this window.');
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).send('Authentication failed!');
  }
});

app.listen(PORT, () => {
  console.error(`Auth server running at http://localhost:${PORT}`);
}); 