import path from 'path';
import { fileURLToPath } from 'url';

function getSecureTokenPath(): string {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    return path.join(__dirname, '../.gcp-saved-tokens.json');
}

export { getSecureTokenPath };
