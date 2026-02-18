import MarkdownIt from 'markdown-it';
import katex from 'katex';

import { KATEX_CSS } from '../constants/katex-css';

// CSS-side palette mirroring constants/design-tokens.ts Palette values.
// Kept here to avoid pulling in react-native's Platform (used by design-tokens)
// in non-RN contexts (e.g. vitest).
const P = {
  primary:       '#2563EB',
  textPrimary:   '#1E293B',
  textSecondary: '#64748B',
  border:        '#E2E8F0',
  divider:       '#F1F5F9',
  danger:        '#EF4444',
} as const;

// ─── Markdown-it instance ────────────────────────────────────────────────────
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

// ─── Quick detection: does the source contain any rich syntax? ───────────────
const RICH_PATTERN = /[#*_`~\[\]>|\-$\\]/;

export function hasRichContent(source: string): boolean {
  return RICH_PATTERN.test(source);
}

// ─── Public API ──────────────────────────────────────────────────────────────
export type RichTextVariant = 'question' | 'answer';

/**
 * Convert a raw markdown+LaTeX string into a self-contained HTML document
 * suitable for `<WebView source={{ html }} />`.
 */
export function buildRichTextHtml(
  source: string,
  variant: RichTextVariant,
): string {
  const bodyHtml = renderMarkdownWithLatex(source);
  return wrapInHtmlDocument(bodyHtml, variant);
}

// ─── Core pipeline ───────────────────────────────────────────────────────────

interface Placeholder {
  id: string;
  html: string;
}

function renderMarkdownWithLatex(source: string): string {
  const placeholders: Placeholder[] = [];
  let counter = 0;

  // 1. Extract display math  $$...$$  (must run before inline)
  let processed = source.replace(/\$\$([\s\S]+?)\$\$/g, (_match, tex: string) => {
    const id = `%%LATEX_D${counter++}%%`;
    try {
      placeholders.push({
        id,
        html: `<div class="math-display">${katex.renderToString(tex.trim(), {
          displayMode: true,
          throwOnError: false,
          output: 'html',
        })}</div>`,
      });
    } catch {
      placeholders.push({ id, html: `<pre class="math-error">${escapeHtml(tex)}</pre>` });
    }
    return id;
  });

  // 2. Extract inline math  $...$
  processed = processed.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (_match, tex: string) => {
    const id = `%%LATEX_I${counter++}%%`;
    try {
      placeholders.push({
        id,
        html: `<span class="math-inline">${katex.renderToString(tex.trim(), {
          displayMode: false,
          throwOnError: false,
          output: 'html',
        })}</span>`,
      });
    } catch {
      placeholders.push({ id, html: `<code class="math-error">${escapeHtml(tex)}</code>` });
    }
    return id;
  });

  // 3. Render markdown
  let html = md.render(processed);

  // 4. Restore LaTeX placeholders (may be wrapped in <p> by markdown-it)
  for (const { id, html: latexHtml } of placeholders) {
    html = html.replace(new RegExp(`<p>${escapeRegExp(id)}</p>`), latexHtml);
    html = html.replace(id, latexHtml);
  }

  return html;
}

// ─── HTML document wrapper ───────────────────────────────────────────────────

function wrapInHtmlDocument(bodyHtml: string, variant: RichTextVariant): string {
  const fontSize = variant === 'question' ? 20 : 18;
  const fontWeight = variant === 'question' ? '700' : '400';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>
${KATEX_CSS}

*{box-sizing:border-box;margin:0;padding:0;}

body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  font-size:${fontSize}px;
  font-weight:${fontWeight};
  line-height:1.6;
  color:${P.textPrimary};
  background:transparent;
  padding:0;
  overflow-x:hidden;
  word-wrap:break-word;
  overflow-wrap:break-word;
}

h1{font-size:1.5em;font-weight:700;margin:0.6em 0 0.3em;color:${P.primary};}
h2{font-size:1.3em;font-weight:700;margin:0.5em 0 0.25em;color:${P.primary};}
h3{font-size:1.15em;font-weight:600;margin:0.4em 0 0.2em;color:${P.textPrimary};}
h4,h5,h6{font-size:1em;font-weight:600;margin:0.3em 0 0.15em;color:${P.textPrimary};}

p{margin:0.4em 0;}

strong{font-weight:700;}
em{font-style:italic;}

ul,ol{padding-left:1.5em;margin:0.4em 0;}
li{margin:0.15em 0;}

code{
  font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  font-size:0.88em;
  background:${P.divider};
  border-radius:4px;
  padding:0.15em 0.35em;
  color:${P.textPrimary};
}
pre{
  background:${P.divider};
  border-radius:8px;
  padding:12px;
  margin:0.5em 0;
  overflow-x:auto;
  -webkit-overflow-scrolling:touch;
}
pre code{background:none;padding:0;font-size:0.85em;line-height:1.5;}

blockquote{
  border-left:3px solid ${P.primary};
  padding-left:12px;
  margin:0.5em 0;
  color:${P.textSecondary};
  font-style:italic;
}

hr{border:none;height:1px;background:${P.border};margin:0.8em 0;}

a{color:${P.primary};text-decoration:none;}

table{border-collapse:collapse;width:100%;margin:0.5em 0;}
th,td{border:1px solid ${P.border};padding:6px 10px;text-align:left;font-size:0.9em;}
th{background:${P.divider};font-weight:600;}

.math-display{
  overflow-x:auto;
  -webkit-overflow-scrolling:touch;
  margin:0.5em 0;
  padding:4px 0;
  max-width:100%;
}
.math-display .katex-display{margin:0;overflow-x:auto;overflow-y:hidden;padding:2px 0;}
.math-inline{display:inline;}
.math-error{color:${P.danger};font-size:0.85em;}

.katex{max-width:100%;}
.katex-display>.katex{max-width:100%;overflow-x:auto;overflow-y:hidden;}
</style>
</head>
<body>${bodyHtml}<script>
function rh(){
  var h=document.documentElement.scrollHeight;
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'resize',height:h}));
}
window.addEventListener('load',function(){setTimeout(rh,50);});
new MutationObserver(rh).observe(document.body,{childList:true,subtree:true,attributes:true});
window.addEventListener('resize',rh);
</script></body>
</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
