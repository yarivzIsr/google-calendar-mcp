import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { z } from "zod";

// Load environment variables
dotenv.config();

// Define Zod schemas for validation
const ListEventsArgumentsSchema = z.object({
  calendarId: z.string(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
});

const CreateEventArgumentsSchema = z.object({
  calendarId: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  start: z.string(),
  end: z.string(),
  attendees: z.array(z.string()).optional(),
  location: z.string().optional(),
});

const UpdateEventArgumentsSchema = z.object({
  calendarId: z.string(),
  eventId: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  location: z.string().optional(),
});

const DeleteEventArgumentsSchema = z.object({
  calendarId: z.string(),
  eventId: z.string(),
});

// Create server instance
const server = new Server(
  {
    name: "google-calendar",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize OAuth2 client
const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET
});

// Helper function to load and refresh tokens
async function loadSavedTokens(): Promise<boolean> {
  try {
    const tokenPath = '/Users/nate/Projects/google-calendar-mcp/.calendar-tokens.json';
    const tokens = JSON.parse(await fs.readFile(tokenPath, 'utf-8'));
    oauth2Client.setCredentials(tokens);
    
    const expiryDate = tokens.expiry_date;
    const isExpired = expiryDate ? Date.now() >= (expiryDate - 5 * 60 * 1000) : true;

    if (isExpired && tokens.refresh_token) {
      const response = await oauth2Client.refreshAccessToken();
      const newTokens = response.credentials;
      await fs.writeFile(tokenPath, JSON.stringify(newTokens, null, 2));
      oauth2Client.setCredentials(newTokens);
    }

    oauth2Client.on('tokens', async (newTokens) => {
      const currentTokens = JSON.parse(await fs.readFile(tokenPath, 'utf-8'));
      const updatedTokens = {
        ...currentTokens,
        ...newTokens,
        refresh_token: newTokens.refresh_token || currentTokens.refresh_token
      };
      await fs.writeFile(tokenPath, JSON.stringify(updatedTokens, null, 2));
    });

    return true;
  } catch (error) {
    console.error('Error loading tokens:', error);
    return false;
  }
}

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
            location: {
              type: "string",
              description: "Location of the event",
            },
          },
          required: ["calendarId", "summary", "start", "end", "location"],
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
            location: {
              type: "string",
              description: "New location of the event",
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
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    switch (name) {
      case "list-calendars": {
        const response = await calendar.calendarList.list();
        const calendars = response.data.items || [];
        return {
          content: [{
            type: "text",
            text: calendars.map(cal => `${cal.summary} (${cal.id})`).join('\n')
          }]
        };
      }

      case "list-events": {
        const validArgs = ListEventsArgumentsSchema.parse(args);
        const response = await calendar.events.list({
          calendarId: validArgs.calendarId,
          timeMin: validArgs.timeMin,
          timeMax: validArgs.timeMax,
          singleEvents: true,
          orderBy: 'startTime',
        });
        
        const events = response.data.items || [];
        return {
          content: [{
            type: "text",
            text: events.map(event => {
              const attendeeList = event.attendees 
                ? `\nAttendees: ${event.attendees.map(a => `${a.email} (${a.responseStatus})`).join(', ')}`
                : '';
              const locationInfo = event.location ? `\nLocation: ${event.location}` : '';
              return `${event.summary} (${event.id})${locationInfo}\nStart: ${event.start?.dateTime || event.start?.date}\nEnd: ${event.end?.dateTime || event.end?.date}${attendeeList}\n`;
            }).join('\n')
          }]
        };
      }

      case "create-event": {
        const validArgs = CreateEventArgumentsSchema.parse(args);
        const response = await calendar.events.insert({
          calendarId: validArgs.calendarId,
          requestBody: {
            summary: validArgs.summary,
            description: validArgs.description,
            start: { dateTime: validArgs.start },
            end: { dateTime: validArgs.end },
            attendees: validArgs.attendees?.map(email => ({ email })),
            location: validArgs.location,
          },
        });
        
        return {
          content: [{
            type: "text",
            text: `Event created: ${response.data.summary} (${response.data.id})`
          }]
        };
      }

      case "update-event": {
        const validArgs = UpdateEventArgumentsSchema.parse(args);
        const response = await calendar.events.patch({
          calendarId: validArgs.calendarId,
          eventId: validArgs.eventId,
          requestBody: {
            summary: validArgs.summary,
            description: validArgs.description,
            start: validArgs.start ? { dateTime: validArgs.start } : undefined,
            end: validArgs.end ? { dateTime: validArgs.end } : undefined,
            attendees: validArgs.attendees?.map(email => ({ email })),
            location: validArgs.location,
          },
        });
        
        return {
          content: [{
            type: "text",
            text: `Event updated: ${response.data.summary} (${response.data.id})`
          }]
        };
      }

      case "delete-event": {
        const validArgs = DeleteEventArgumentsSchema.parse(args);
        await calendar.events.delete({
          calendarId: validArgs.calendarId,
          eventId: validArgs.eventId,
        });
        
        return {
          content: [{
            type: "text",
            text: `Event deleted successfully`
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw error;
  }
});

// Start the server
async function main() {
  // Validate environment variables
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Load tokens
  const isAuthenticated = await loadSavedTokens();
  if (!isAuthenticated) {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
    });
    console.error(`Authentication required. Please:\n1. Start the auth server with 'npm run auth'\n2. Visit: ${authUrl}\n3. Complete the Google authentication\n4. Restart this calendar server`);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Calendar MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});