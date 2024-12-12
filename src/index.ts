import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from './calendar-server.js';

async function main() {
  try {
    // Initialize transport
    const transport = new StdioServerTransport();
    
    // Connect server to transport
    await server.connect(transport);
    
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
