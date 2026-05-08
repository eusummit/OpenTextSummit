#!/usr/bin/env node
// Computes SHA-256 hashes of all inline <script> blocks in each HTML file
// and replaces the CSP_SCRIPT_HASHES placeholder in the CSP meta tag.
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

const CSP_PLACEHOLDER = 'CSP_SCRIPT_HASHES';

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

function sha256(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('base64');
}

const rootDir = path.resolve(__dirname, '..');

let allOk = true;

for (const file of HTML_FILES) {
    const filePath = path.join(rootDir, file);

    if (!fs.existsSync(filePath)) {
        console.warn(`SKIP: ${file} not found`);
        continue;
    }

    let html = fs.readFileSync(filePath, 'utf8');

    if (!html.includes(CSP_PLACEHOLDER)) {
        console.warn(`SKIP: ${file} has no ${CSP_PLACEHOLDER} placeholder`);
        continue;
    }

    const scripts = extractInlineScripts(html);

    if (scripts.length === 0) {
        console.warn(`WARN: ${file} has CSP placeholder but no inline scripts`);
        const updated = html.replace(CSP_PLACEHOLDER, '');
        fs.writeFileSync(filePath, updated, 'utf8');
        continue;
    }

    const hashes = scripts.map(s => `'sha256-${sha256(s)}'`).join(' ');
    console.log(`${file}: ${scripts.length} script block(s) → ${hashes}`);

    const updated = html.replace(CSP_PLACEHOLDER, hashes);
    fs.writeFileSync(filePath, updated, 'utf8');
}

if (!allOk) process.exit(1);
console.log('CSP script hashes injected successfully.');
