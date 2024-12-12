import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// First validate env variables
function validateEnvVariables() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnvVariables();

// Create server instance first
export const server = new Server(
  {
    name: "google-calendar",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {
        enabled: true,
        schemas: {
          listTools: ListToolsRequestSchema,
          callTool: CallToolRequestSchema,
        },
      },
      logging: {
        enabled: true,
      },
    },
  }
);

// Then initialize other components
const PORT = process.env.PORT || 3000;

const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `http://localhost:${PORT}/oauth2callback`
});

// Try to load saved tokens
async function loadSavedTokens() {
  try {
    const tokenPath = path.join(process.cwd(), '.calendar-tokens.json');
    const tokens = JSON.parse(await fs.readFile(tokenPath, 'utf-8'));
    
    // Check if tokens are expired or will expire soon (5 minutes buffer)
    const expiryDate = tokens.expiry_date;
    const isExpired = expiryDate ? Date.now() >= (expiryDate - 5 * 60 * 1000) : true;

    if (isExpired && tokens.refresh_token) {
      // Force token refresh
      oauth2Client.setCredentials(tokens);
      const response = await oauth2Client.refreshAccessToken();
      const newTokens = response.credentials;
      
      // Save new tokens
      await fs.writeFile(tokenPath, JSON.stringify(newTokens, null, 2));
      oauth2Client.setCredentials(newTokens);
    } else {
      oauth2Client.setCredentials(tokens);
    }

    // Set up token refresh handler
    oauth2Client.on('tokens', async (newTokens) => {
      const currentTokens = JSON.parse(await fs.readFile(tokenPath, 'utf-8'));
      const updatedTokens = {
        ...currentTokens,
        ...newTokens,
        // Preserve refresh_token if not in newTokens
        refresh_token: newTokens.refresh_token || currentTokens.refresh_token
      };
      await fs.writeFile(tokenPath, JSON.stringify(updatedTokens, null, 2));
    });

    return true;
  } catch (error) {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
    });

    server.sendLoggingMessage({
      level: "error",
      data: `Authentication required. Please:\n1. Start the auth server with 'npm run auth'\n2. Visit: ${authUrl}\n3. Complete the Google authentication\n4. Restart this calendar server`
    });
    return false;
  }
}

// Rename main to initialize and export it
export async function initialize() {
  const isAuthenticated = await loadSavedTokens();
  if (!isAuthenticated) {
    server.sendLoggingMessage({
      level: "error",
      data: "Authentication required. Please run the auth server first and authenticate."
    });
    return false;
  }

  // Initialize calendar client after authentication
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list-calendars",
          description: "List all available calendars",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "list-events",
          description: "List events from a calendar",
          inputSchema: {
            type: "object",
            properties: {
              calendarId: {
                type: "string",
                description: "ID of the calendar to list events from",
              },
              timeMin: {
                type: "string",
                description: "Start time in ISO format (optional)",
              },
              timeMax: {
                type: "string", 
                description: "End time in ISO format (optional)",
              },
            },
            required: ["calendarId"],
          },
        },
        {
          name: "create-event",
          description: "Create a new calendar event",
          inputSchema: {
            type: "object",
            properties: {
              calendarId: {
                type: "string",
                description: "ID of the calendar to create event in",
              },
              summary: {
                type: "string",
                description: "Title of the event",
              },
              description: {
                type: "string",
                description: "Description of the event",
              },
              start: {
                type: "string",
                description: "Start time in ISO format",
              },
              end: {
                type: "string",
                description: "End time in ISO format", 
              },
            },
            required: ["calendarId", "summary", "start", "end"],
          },
        },
        {
          name: "update-event",
          description: "Update an existing calendar event",
          inputSchema: {
            type: "object", 
            properties: {
              calendarId: {
                type: "string",
                description: "ID of the calendar containing the event",
              },
              eventId: {
                type: "string",
                description: "ID of the event to update",
              },
              summary: {
                type: "string",
                description: "New title of the event",
              },
              description: {
                type: "string",
                description: "New description of the event",
              },
              start: {
                type: "string",
                description: "New start time in ISO format",
              },
              end: {
                type: "string",
                description: "New end time in ISO format",
              },
            },
            required: ["calendarId", "eventId"],
          },
        },
        {
          name: "delete-event",
          description: "Delete a calendar event",
          inputSchema: {
            type: "object",
            properties: {
              calendarId: {
                type: "string",
                description: "ID of the calendar containing the event",
              },
              eventId: {
                type: "string",
                description: "ID of the event to delete",
              },
            },
            required: ["calendarId", "eventId"],
          },
        },
      ],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    // Check if we have valid authentication
    if (!oauth2Client.credentials.access_token) {
      console.error('Authentication missing - returning error response');
      return {
        isError: true,
        content: [{
          type: "text",
          text: "Not authenticated. Please authenticate with Google Calendar first.",
        }],
      };
    }

    try {
      switch (name) {
        case "list-calendars": {
          const response = await calendar.calendarList.list();
          const calendars = response.data.items?.map(cal => ({
            id: cal.id,
            summary: cal.summary,
            description: cal.description,
          }));
          
          const formattedText = calendars?.map(cal => 
            `Calendar: ${cal.summary}\n` +
            `ID: ${cal.id}\n` +
            `Description: ${cal.description || 'N/A'}`
          ).join('\n\n') || 'No calendars found';
          
          return {
            content: [{
              type: "text",
              text: formattedText,
            }],
          };
        }

        case "list-events": {
          const { calendarId, timeMin, timeMax } = args as any;
          const response = await calendar.events.list({
            calendarId,
            timeMin: timeMin || new Date().toISOString(),
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime',
          });

          const events = response.data.items?.map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start,
            end: event.end,
          }));

          return {
            content: [{
              type: "text",
              text: JSON.stringify(events, null, 2),
            }],
          };
        }

        case "create-event": {
          const { calendarId, summary, description, start, end } = args as any;
          const response = await calendar.events.insert({
            calendarId,
            requestBody: {
              summary,
              description,
              start: { dateTime: start },
              end: { dateTime: end },
            },
          });

          return {
            content: [{
              type: "text",
              text: `Event created successfully. Event ID: ${response.data.id}`,
            }],
          };
        }

        case "update-event": {
          const { calendarId, eventId, summary, description, start, end } = args as any;
          const response = await calendar.events.patch({
            calendarId,
            eventId,
            requestBody: {
              summary,
              description,
              start: start ? { dateTime: start } : undefined,
              end: end ? { dateTime: end } : undefined,
            },
          });

          return {
            content: [{
              type: "text",
              text: `Event updated successfully. Event ID: ${response.data.id}`,
            }],
          };
        }

        case "delete-event": {
          const { calendarId, eventId } = args as any;
          await calendar.events.delete({
            calendarId,
            eventId,
          });

          return {
            content: [{
              type: "text",
              text: "Event deleted successfully.",
            }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error('Error handling tool request:', error);
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        }],
      };
    }
  });

  return true;
}

// Main function to start the server
async function main() {
  try {
    // Initialize transport and connect first
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Try to initialize up to 3 times with a delay
    for (let i = 0; i < 3; i++) {
      const initialized = await initialize();
      if (initialized) {
        server.sendLoggingMessage({
          level: "info",
          data: "Google Calendar MCP server started successfully"
        });
        return;
      }
      
      // Wait 2 seconds before retrying
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // If we get here, initialization failed
    server.sendLoggingMessage({
      level: "error",
      data: "Failed to initialize after multiple attempts. Please ensure you've authenticated via 'npm run auth' first."
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
main();