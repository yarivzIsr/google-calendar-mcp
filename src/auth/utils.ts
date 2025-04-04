import * as path from 'path';
import { fileURLToPath } from 'url';

// Returns the path for the saved token file within the project root.
export function getSecureTokenPath(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url)); 
  // __dirname is .../google-calendar-mcp/src/auth
  // Go up two levels to get the project root
  const projectRoot = path.join(__dirname, ".."); 
  const tokenPath = path.join(projectRoot, ".gcp-saved-tokens.json"); // Save in project root, hidden file
  // Use resolve to ensure an absolute path
  const absolutePath = path.resolve(tokenPath);
  return absolutePath;
} 