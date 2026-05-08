#!/usr/bin/env node
// Computes SHA-256 hashes of all inline <script> and <style> blocks in each HTML file
// and replaces the CSP_SCRIPT_HASHES / CSP_STYLE_HASHES placeholders in the CSP meta tag.
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

const rootDir = path.resolve(__dirname, '..');

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
}

console.log('CSP script and style hashes injected successfully.');
