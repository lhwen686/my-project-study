#!/usr/bin/env node
// Extracts KaTeX CSS and inlines it as a TypeScript string constant.
// Strips @font-face rules since we use KaTeX output:'html' mode.
// Re-run after upgrading katex: node scripts/extract-katex-css.js

const fs = require('fs');
const path = require('path');

const cssPath = require.resolve('katex/dist/katex.min.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Strip @font-face blocks (not needed for output:'html' mode)
css = css.replace(/@font-face\s*\{[^}]*\}/g, '');

// Escape backticks and backslashes for template literal
const escaped = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

const output = `// Auto-generated from katex/dist/katex.min.css — do not edit manually.
// Regenerate: node scripts/extract-katex-css.js
export const KATEX_CSS = \`${escaped}\`;
`;

const outPath = path.join(__dirname, '..', 'constants', 'katex-css.ts');
fs.writeFileSync(outPath, output, 'utf8');
console.log(`Wrote ${outPath} (${css.length} chars of CSS)`);
