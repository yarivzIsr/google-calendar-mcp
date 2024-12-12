import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server, initialize } from './calendar-server.js';

async function main() {
  try {
    // Initialize transport first
    const transport = new StdioServerTransport();
    
    // Connect server to transport
    await server.connect(transport);

    // Initialize server and authentication
    const initialized = await initialize();
    if (!initialized) {
      server.sendLoggingMessage({
        level: "error",
        data: "Failed to initialize server - authentication required"
      });
      process.exit(1);
    }
    
    server.sendLoggingMessage({
      level: "info",
      data: "Google Calendar MCP server started successfully"
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
