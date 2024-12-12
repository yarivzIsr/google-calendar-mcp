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
const server = new Server(
  {
    name: "google-calendar",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {},
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
    
    // Set credentials and handle token refresh
    oauth2Client.setCredentials(tokens);
    
    // Set up token refresh handler
    oauth2Client.on('tokens', async (newTokens) => {
      const updatedTokens = {
        ...tokens,
        ...newTokens,
      };
      await fs.writeFile(tokenPath, JSON.stringify(updatedTokens));
    });

    
    server.sendLoggingMessage({
      level: "info",
      data: "Successfully loaded authentication tokens"
    });

    return true;
  } catch (error) {
    server.sendLoggingMessage({
      level: "warning",
      data: "No saved tokens found or invalid tokens. Authentication required."
    });

    // Generate authentication URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
    });

    server.sendLoggingMessage({
      level: "info",
      data: `Please authenticate by visiting: ${authUrl}`
    });

    return false;
  }
}

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

// Modify the main function to handle authentication state
export async function main() {
  const isAuthenticated = await loadSavedTokens();
  if (!isAuthenticated) {
    server.sendLoggingMessage({
      level: "error",
      data: "Authentication required. Please run the auth server first and authenticate."
    });
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export { server };