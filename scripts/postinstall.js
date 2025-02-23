import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
    try {
        // Run tsc build first
        const { execSync } = await import('child_process');
        execSync('npm run build', { stdio: 'inherit' });

        // Add shebang to the built file
        const buildPath = join(__dirname, '..', 'build', 'index.js');
        const content = await fs.readFile(buildPath, 'utf8');
        const shebang = '#!/usr/bin/env node\n';
        
        // Only add shebang if it's not already there
        if (!content.startsWith(shebang)) {
            await fs.writeFile(buildPath, shebang + content);
        }

        // On non-Windows platforms, make the file executable
        if (process.platform !== 'win32') {
            await fs.chmod(buildPath, 0o755);
        }
    } catch (error) {
        console.error('Error in postinstall script:', error);
        process.exit(1);
    }
}

main(); 