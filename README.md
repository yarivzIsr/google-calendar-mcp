# Google Calendar MCP Server

This is a Model Context Protocol (MCP) server that provides integration with Google Calendar. It allows LLMs to read, create, and manage calendar events through a standardized interface.

## Features

- Calendar Management:
  - List and select available calendars
  - View calendar events with detailed information
  - Create new calendar events
  - Update existing events
  - Delete events
  - Manage event attendees and responses
  - Support for multiple calendars (both primary and secondary)

- Security & Authentication:
  - Secure OAuth 2.0 authentication flow
  - Automatic token refresh handling
  - Secure storage of credentials and tokens
 
## Example Usage

Along with the normal capabilities you would expect for a calendar integration you can also do really dynamic things like add events from screenshots and images and much more.

1. Add events from screenshots and images:
   ```
   Add this event to my calendar based on the attached screenshot.
   ```
   Supported image formats: PNG, JPEG, GIF
   Images can contain event details like date, time, location, and description
   
2. Calendar analysis:
   ```
   What events do I have coming up this week that aren't part of my usual routine?
   ```
3. Check attendance:
   ```
   Which events tomorrow have attendees who have not accepted the invitation?
   ```
4. Auto coordinate events:
   ```
   Here's some available that was provided to me by someone. Take a look at the available times and create an event that is free on my work calendar.
   ```
5. Provide your own availability:
   ```
   Please provide availability looking at both my personal and work calendar for this upcoming week. Choose times that work well for normal working hours on the East Coast. Meeting time is 1 hour
   ```

## Requirements

1. Node.js (Latest LTS recommended)
2. TypeScript 5.3 or higher
3. A Google Cloud project with the Calendar API enabled
4. OAuth 2.0 credentials (Client ID and Client Secret)

## Project Structure

```
google-calendar-mcp/
├── src/              # TypeScript source files
│   ├── index.ts      # Main server implementation
│   ├── auth-server.ts # OAuth authentication server
│   └── token-manager.ts # Token management utilities
├── build/           # Compiled JavaScript output
├── scripts/         # Build and utility scripts
├── llm/            # LLM-specific configurations and prompts
├── logs/           # Server logs
├── package.json    # Project dependencies and scripts
└── tsconfig.json   # TypeScript configuration
```

## Google Cloud Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one.
3. Enable the [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) for your project. Ensure that the right project is selected from the top bar before enabling the API.
4. Create OAuth 2.0 credentials:
   - Go to Credentials
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "User data" for the type of data that the app will be accessing
   - Add your app name and contact information
   - Add the following scopes (optional):
     - `https://www.googleapis.com/auth/calendar.events`
   - Select "Desktop app" as the application type
   - Add your email address as a test user under the [OAuth Consent screen](https://console.cloud.google.com/apis/credentials/consent)
      - Note: it will take a few minutes for the test user to be added. The OAuth consent will not allow you to proceed until the test user has propogated.
      - Note about test mode: While an app is in test mode the auth tokens will expire after 1 week and need to be refreshed by running `npm run auth`.

## Installation

1. Clone the repository
2. Install dependencies (this also builds the js, postinstall):
   ```bash
   npm install
   ```
3. Download your Google OAuth credentials from the Google Cloud Console (under "Credentials") and rename the file to `gcp-oauth.keys.json` and place it in the root directory of the project.
   - Alternatively, copy the provided template file: `cp gcp-oauth.keys.example.json gcp-oauth.keys.json` and populate it with your credentials from the Google Cloud Console.

## Available Scripts

- `npm run build` - Build the TypeScript code and run type checks
- `npm run typecheck` - Run TypeScript type checking
- `npm run start` - Start the compiled server
- `npm run dev` - Start the server in development mode using ts-node
- `npm run auth` - Start the authentication server for Google OAuth flow

## Authentication

The server supports both automatic and manual authentication flows:

### Automatic Authentication (Recommended)
1. Place your Google OAuth credentials in a file named `gcp-oauth.keys.json` in the root directory of the project.
2. Start the MCP server:
   ```bash
   npm start
   ```
3. If no valid authentication tokens are found, the server will automatically:
   - Start an authentication server (on ports 3000-3004)
   - Open a browser window for the OAuth flow
   - Save the tokens securely once authenticated
   - Shut down the auth server
   - Continue normal MCP server operation

The server automatically manages token refresh and re-authentication when needed:
- Tokens are automatically refreshed before expiration
- If refresh fails, clear error messages guide you through re-authentication
- Token files are stored securely with restricted permissions

### Manual Authentication
For advanced users or troubleshooting, you can manually run the authentication flow:
```bash
npm run auth
```

This will:
1. Start the authentication server
2. Open a browser window for the OAuth flow
3. Save the tokens and exit

### Security Notes
- OAuth credentials are stored in `gcp-oauth.keys.json` (you can use the included `gcp-oauth.keys.example.json` template as a starting point)
- Authentication tokens are stored in `.gcp-saved-tokens.json` with 600 permissions
- Tokens are automatically refreshed in the background
- Token integrity is validated before each API call
- The auth server automatically shuts down after successful authentication
- Never commit OAuth credentials or token files to version control

## Usage

The server exposes the following MCP tools:

- Calendar Management:
  - `list-calendars`: List all available calendars
  - `get-calendar`: Get details of a specific calendar
  - `list-events`: List events from a calendar with filtering options
  - `get-event`: Get detailed information about a specific event
  - `create-event`: Create a new calendar event
  - `update-event`: Update an existing calendar event
  - `delete-event`: Delete a calendar event
  - `list-colors`: List available colors for events and calendars


## Using with Claude Desktop

1. Add this configuration to your Claude Desktop config file. E.g. `/Users/<user>/Library/Application Support/Claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "google-calendar": {
         "command": "node",
         "args": ["<absolute-path-to-project>/build/index.js"]
       }
     }
   }
   ```
   Note: Replace `<absolute-path-to-project>` with the actual path to your project directory.

2. Restart Claude Desktop


## Development

### Troubleshooting

Common issues and solutions:

1. OAuth Token expires after one week (7 days)
   - Apps that are in testing mode, rather than production, will need to go through the OAuth flow again after a week.

3. OAuth Token Errors
   - Ensure your `gcp-oauth.keys.json` is correctly formatted (check against the structure in `gcp-oauth.keys.example.json`)
   - Try deleting `.gcp-saved-tokens.json` and re-authenticating
   
4. TypeScript Build Errors
   - Make sure all dependencies are installed: `npm install`
   - Check your Node.js version matches prerequisites
   - Clear the build directory: `rm -rf build/`

5. Image Processing Issues
   - Verify the image format is supported
   - Ensure the image contains clear, readable text

## Security Notes

- The server runs locally and requires OAuth authentication
- OAuth credentials should be stored in `gcp-oauth.keys.json` in the project root
- Authentication tokens are stored in `.gcp-saved-tokens.json` with restricted file permissions
- Never commit your OAuth credentials or token files to version control
- For production use, get your OAuth application verified by Google

## License

MIT
