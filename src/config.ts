import * as path from 'path';
import { fileURLToPath } from 'url';

export function getKeysFilePath(): string {
    const __dirname = path.dirname(fileURLToPath(import.meta.url)); 
    // __dirname is .../google-calendar-mcp/src
    // We need to go up one level to the project root
    const projectRoot = path.join(__dirname, ".."); 
    const keysPath = path.join(projectRoot, "gcp-oauth.keys.json");
    // Use resolve to ensure an absolute path, although join from dirname should be absolute
    const absolutePath = path.resolve(keysPath);
    return absolutePath;
} 