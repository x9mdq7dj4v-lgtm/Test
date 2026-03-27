//astro.config.mjs
import { defineConfig } from 'astro/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

function generateCSPHash(content) {
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('base64');
  return `'sha256-${hash}'`;
}

export default defineConfig({
  security: {
    csp: true,
  },
  integrations: [
    {
      name: 'auto-csp-hashes',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          const distDir = new URL(dir).pathname;
          
          async function processDirectory(directory) {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(directory, entry.name);
              if (entry.isDirectory()) {
                await processDirectory(fullPath);
              } else if (entry.isFile() && fullPath.endsWith('.html')) {
                await processHtmlFile(fullPath);
              }
            }
          }

          async function processHtmlFile(htmlPath) {
             let html = await fs.readFile(htmlPath, 'utf8');
             
             const scriptHashes = new Set();
             const styleHashes = new Set();
             
             // Extract inline script contents
             const inlineScriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
             let match;
             while ((match = inlineScriptRegex.exec(html)) !== null) {
                if (match[1].trim()) {
                   scriptHashes.add(generateCSPHash(match[1]));
                }
             }
             
             // Extract inline style contents
             const inlineStyleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
             while ((match = inlineStyleRegex.exec(html)) !== null) {
                if (match[1].trim()) {
                   styleHashes.add(generateCSPHash(match[1]));
                }
             }
             
             const scriptSrc = ["'self'", ...scriptHashes].join(' ');
             const styleSrc = ["'self'", ...styleHashes].join(' ');
             
             const csp = `default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; img-src 'self' data:; connect-src 'self' https://raw.githubusercontent.com;`;
             
             const metaTag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
             
             if (html.includes('<head>')) {
                html = html.replace('<head>', `<head>\n    ${metaTag}`);
             } else {
                html = metaTag + '\n' + html;
             }
             
             await fs.writeFile(htmlPath, html, 'utf8');
          }

          await processDirectory(distDir);
        }
      }
    }
  ]
});
