# Google Calendar MCP Server

This is a Model Context Protocol (MCP) server that provides integration with Google Calendar. It allows LLMs to read, create, and manage calendar events through a standardized interface.

## Features

- List available calendars
- List events from a calendar
- Create new calendar events
- Update existing events
- Delete events

## Prerequisites

1. Node.js 16 or higher
2. A Google Cloud project with the Calendar API enabled
3. OAuth 2.0 credentials (Client ID and Client Secret)

## Setup

1. First, install the dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory with your Google OAuth credentials:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Authentication

Before using the server, you need to authenticate with Google Calendar:

1. Start the authentication server:
   ```bash
   node build/auth-server.js
   ```

2. Open http://localhost:3000 in your browser
3. Follow the Google OAuth flow to grant access to your calendars
4. Once complete, you can close the browser window

The authentication tokens will be saved to `.calendar-tokens.json` and automatically loaded by the server.

## Usage

1. Start the MCP server:
   ```bash
   node build/calendar-server.js
   ```

2. The server exposes the following tools:

   - `list-calendars`: List all available calendars
   - `list-events`: List events from a calendar
   - `create-event`: Create a new calendar event
   - `update-event`: Update an existing calendar event
   - `delete-event`: Delete a calendar event

## Using with Claude Desktop

1. Add this configuration to your Claude Desktop config file:
   ```json
   {
     "mcpServers": {
       "google-calendar": {
         "command": "node",
         "args": ["path/to/build/calendar-server.js"]
       }
     }
   }
   ```

2. Restart Claude Desktop

## Example Usage

Here are some example prompts you can use with Claude:

1. List your calendars:
   ```
   Can you list my available calendars?
   ```

2. List events:
   ```
   Show me my events for next week in calendar [calendar-id]
   ```

3. Create an event:
   ```
   Create a meeting titled "Team Sync" for tomorrow at 2 PM for 1 hour in calendar [calendar-id]
   ```

4. Update an event:
   ```
   Update the event [event-id] in calendar [calendar-id] to start at 3 PM instead
   ```

5. Delete an event:
   ```
   Delete the event [event-id] from calendar [calendar-id]
   ```

## Security Notes

- The server runs locally and requires OAuth authentication
- Tokens are stored locally in `.calendar-tokens.json`
- All calendar operations require explicit user approval through the MCP protocol
- Never share your OAuth credentials or token file

## License

MIT
