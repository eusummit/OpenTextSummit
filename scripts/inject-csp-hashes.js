#!/usr/bin/env node
// Computes SHA-256 hashes of all inline <script> and <style> blocks in each HTML file
// and replaces the CSP_SCRIPT_HASHES / CSP_STYLE_HASHES placeholders in the CSP meta tag.
// Also writes per-file Content-Security-Policy entries to _headers so CSP is enforced
// at the HTTP header level (stronger than meta-tag-only CSP).
// Must run AFTER minification so hashes match the minified content.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const HTML_FILES = [
    'index.html',
    'login.html',
    'methodology.html',
    'privacy.html',
    'terms.html',
];

const SCRIPT_PLACEHOLDER = 'CSP_SCRIPT_HASHES';
const STYLE_PLACEHOLDER = 'CSP_STYLE_HASHES';

function extractInlineScripts(html) {
    const blocks = [];
    // Match <script> blocks without a src= attribute
    const re = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
        const content = match[1];
        if (content.trim().length > 0) {
            blocks.push(content);
        }
    }
    return blocks;
}

function extractInlineStyles(html) {
    const blocks = [];
    const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
        const content = match[1];
        if (content.trim().length > 0) {
            blocks.push(content);
        }
    }
    return blocks;
}

function sha256(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('base64');
}

function extractCspContent(html) {
    const match = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']/i);
    return match ? match[1] : null;
}

const rootDir = path.resolve(__dirname, '..');

// Collect per-file CSP strings to write to _headers after processing all HTML files
const cspEntries = [];

for (const file of HTML_FILES) {
    const filePath = path.join(rootDir, file);

    if (!fs.existsSync(filePath)) {
        console.warn(`SKIP: ${file} not found`);
        continue;
    }

    let html = fs.readFileSync(filePath, 'utf8');

    // --- Script hashes ---
    if (!html.includes(SCRIPT_PLACEHOLDER)) {
        console.warn(`SKIP scripts: ${file} has no ${SCRIPT_PLACEHOLDER} placeholder`);
    } else {
        const scripts = extractInlineScripts(html);
        if (scripts.length === 0) {
            console.warn(`WARN: ${file} has CSP script placeholder but no inline scripts`);
            html = html.replace(SCRIPT_PLACEHOLDER, '');
        } else {
            const hashes = scripts.map(s => `'sha256-${sha256(s)}'`).join(' ');
            console.log(`${file}: ${scripts.length} script block(s) → ${hashes}`);
            html = html.replace(SCRIPT_PLACEHOLDER, hashes);
        }
    }

    // --- Style hashes ---
    if (!html.includes(STYLE_PLACEHOLDER)) {
        console.warn(`SKIP styles: ${file} has no ${STYLE_PLACEHOLDER} placeholder`);
    } else {
        const styles = extractInlineStyles(html);
        if (styles.length === 0) {
            console.warn(`WARN: ${file} has CSP style placeholder but no inline styles`);
            html = html.replace(STYLE_PLACEHOLDER, '');
        } else {
            const hashes = styles.map(s => `'sha256-${sha256(s)}'`).join(' ');
            console.log(`${file}: ${styles.length} style block(s) → ${hashes}`);
            html = html.replace(STYLE_PLACEHOLDER, hashes);
        }
    }

    fs.writeFileSync(filePath, html, 'utf8');

    // Collect CSP for HTTP header injection
    const csp = extractCspContent(html);
    if (csp) {
        cspEntries.push({ path: `/${file}`, csp });
    } else {
        console.warn(`WARN: ${file} has no CSP meta tag to promote to HTTP header`);
    }
}

// --- Write per-file CSP entries to _headers ---
const headersPath = path.join(rootDir, '_headers');
let headersContent = fs.existsSync(headersPath) ? fs.readFileSync(headersPath, 'utf8') : '';

// Strip any previously injected per-file CSP block (between markers)
headersContent = headersContent.replace(
    /\n# BEGIN CSP-PER-FILE[\s\S]*?# END CSP-PER-FILE\n?/,
    ''
);

// Append fresh per-file CSP entries
const cspBlock = cspEntries
    .map(({ path: p, csp }) => `${p}\n  Content-Security-Policy: ${csp}`)
    .join('\n');

headersContent = headersContent.trimEnd() + '\n\n# BEGIN CSP-PER-FILE\n' + cspBlock + '\n# END CSP-PER-FILE\n';

fs.writeFileSync(headersPath, headersContent, 'utf8');
console.log(`_headers updated with CSP for: ${cspEntries.map(e => e.path).join(', ')}`);

console.log('CSP script and style hashes injected successfully.');
