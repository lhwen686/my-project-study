/**
 * RichTextRenderer — self-contained WebView pre-rendering engine.
 *
 * Architecture: dual-track
 *   • Plain text  → native <Text> (zero-overhead fast path)
 *   • Rich content → HTML pre-rendered in JS (markdown-it + KaTeX),
 *                    displayed inside a sandboxed <WebView>
 *
 * LaTeX handling:
 *   $$...$$  display math  — extracted BEFORE inline pass to avoid conflict
 *   $...$    inline math   — negative-lookahead prevents double-$ false positives
 *
 * Display equations support horizontal overflow-x scroll to prevent clipping.
 */

import katex from 'katex';
import MarkdownIt from 'markdown-it';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { KATEX_CSS } from '@/constants/katex-css';

// ─── Public types ─────────────────────────────────────────────────────────────

export type RichTextVariant = 'question' | 'answer';

type Props = {
  /** Raw markdown + LaTeX source string (the card front or back). */
  content: string;
  /** Controls typography: question = 20 px bold, answer = 18 px regular. */
  variant: RichTextVariant;
  /** Optional outer container style overrides. */
  style?: ViewStyle;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_HEIGHT = 24;
const FALLBACK_HEIGHT = 60;

/** Characters that signal markdown or LaTeX syntax. */
const RICH_RE = /[#*_`~[\]>|\-$\\]/;

// ─── markdown-it instance (module-level singleton) ────────────────────────────

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// ─── CSS palette (mirrors design-tokens.ts without importing Platform) ────────

const P = {
  primary:       '#2563EB',
  textPrimary:   '#1E293B',
  textSecondary: '#64748B',
  border:        '#E2E8F0',
  surface:       '#F1F5F9',
  danger:        '#EF4444',
} as const;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Drop-in renderer for Markdown + LaTeX card content.
 *
 * Renders plain text natively and routes rich content through a WebView
 * that receives fully pre-rendered HTML (no katex.js shipped to the webview).
 */
export function RichTextRenderer({ content, variant, style }: Props) {
  if (!RICH_RE.test(content)) {
    // Fast path: zero-overhead native text
    return (
      <Text
        style={[
          variant === 'question' ? plain.question : plain.answer,
          style as TextStyle,
        ]}
      >
        {content}
      </Text>
    );
  }
  // Rich path: hooks must be in a stable component — delegate to RichWebView
  return <RichWebView content={content} variant={variant} style={style} />;
}

// ─── Internal WebView component ───────────────────────────────────────────────

function RichWebView({ content, variant, style }: Props) {
  const [height, setHeight] = useState(FALLBACK_HEIGHT);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const html = useMemo(
    () => buildHtmlDocument(content, variant),
    [content, variant],
  );

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [content, fadeAnim]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as unknown;
      if (
        data !== null &&
        typeof data === 'object' &&
        'type' in data &&
        'height' in data &&
        (data as { type: unknown }).type === 'resize' &&
        typeof (data as { height: unknown }).height === 'number'
      ) {
        setHeight(Math.max(MIN_HEIGHT, Math.ceil((data as { height: number }).height)));
      }
    } catch {
      // ignore malformed postMessage payloads
    }
  }, []);

  return (
    <Animated.View style={[styles.container, { height, opacity: fadeAnim }, style]}>
      <WebView
        source={{ html }}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(req) =>
          req.url === 'about:blank' || req.url.startsWith('data:')
        }
        {...(Platform.OS === 'android' ? { androidLayerType: 'hardware' } : {})}
      />
    </Animated.View>
  );
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

interface Slot {
  id: string;
  html: string;
}

/**
 * Convert raw markdown+LaTeX source into a fully self-contained HTML document.
 *
 * Pipeline:
 *  1. Extract  $$...$$  display blocks → placeholder tokens
 *  2. Extract  $...$    inline spans   → placeholder tokens
 *  3. Run markdown-it on the sanitised source
 *  4. Rehydrate all placeholder tokens with pre-rendered KaTeX HTML
 *  5. Wrap in an HTML document shell with embedded CSS + resize script
 */
function buildHtmlDocument(source: string, variant: RichTextVariant): string {
  const slots: Slot[] = [];
  let n = 0;

  // Step 1 — display math  $$...$$  (must precede inline pass)
  let src = source.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => {
    const id = `\u0000DMATH${n++}\u0000`;
    try {
      slots.push({
        id,
        html: `<div class="math-block">${katex.renderToString(tex.trim(), {
          displayMode: true,
          throwOnError: false,
          output: 'html',
        })}</div>`,
      });
    } catch {
      slots.push({ id, html: `<pre class="math-err">${esc(tex)}</pre>` });
    }
    return id;
  });

  // Step 2 — inline math  $...$  (negative look-around guards against $$)
  src = src.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_m, tex: string) => {
    const id = `\u0000IMATH${n++}\u0000`;
    try {
      slots.push({
        id,
        html: `<span class="math-inline">${katex.renderToString(tex.trim(), {
          displayMode: false,
          throwOnError: false,
          output: 'html',
        })}</span>`,
      });
    } catch {
      slots.push({ id, html: `<code class="math-err">${esc(tex)}</code>` });
    }
    return id;
  });

  // Step 3 — render markdown
  let body = md.render(src);

  // Step 4 — restore KaTeX HTML (placeholder may be wrapped in <p>...</p>)
  for (const { id, html } of slots) {
    const escaped = id.replace(/\u0000/g, '\\u0000').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(`<p>${escaped}</p>`), html);
    body = body.replace(id, html);
  }

  // Step 5 — shell
  return htmlShell(body, variant);
}

// ─── HTML shell ───────────────────────────────────────────────────────────────

function htmlShell(body: string, variant: RichTextVariant): string {
  const fontSize   = variant === 'question' ? 20 : 18;
  const fontWeight = variant === 'question' ? '700' : '400';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>
${KATEX_CSS}

*{box-sizing:border-box;margin:0;padding:0;}

html,body{
  background:#F8FAFC;
  -webkit-text-size-adjust:100%;
}

@keyframes fadeIn{from{opacity:0}to{opacity:1}}

body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  font-size:${fontSize}px;
  font-weight:${fontWeight};
  line-height:1.6;
  color:${P.textPrimary};
  padding:0;
  overflow-x:hidden;
  word-wrap:break-word;
  overflow-wrap:break-word;
  animation:fadeIn 0.3s ease-in;
}

/* ── Headings ─────────────────────────────────────────────────────────────── */
h1{font-size:1.5em;font-weight:700;margin:.5em 0 .25em;color:${P.primary};}
h2{font-size:1.3em;font-weight:700;margin:.45em 0 .2em;color:${P.primary};}
h3{font-size:1.15em;font-weight:600;margin:.4em 0 .15em;}
h4,h5,h6{font-size:1em;font-weight:600;margin:.3em 0 .1em;}

/* ── Inline ───────────────────────────────────────────────────────────────── */
p{margin:.35em 0;}
strong{font-weight:700;}
em{font-style:italic;}
a{color:${P.primary};text-decoration:none;}

/* ── Lists ────────────────────────────────────────────────────────────────── */
ul,ol{padding-left:1.4em;margin:.35em 0;}
li{margin:.12em 0;}

/* ── Code ─────────────────────────────────────────────────────────────────── */
code{
  font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  font-size:.88em;
  background:${P.surface};
  border-radius:4px;
  padding:.12em .3em;
}
pre{
  background:${P.surface};
  border-radius:8px;
  padding:10px 12px;
  margin:.5em 0;
  overflow-x:auto;
  -webkit-overflow-scrolling:touch;
}
pre code{background:none;padding:0;font-size:.85em;line-height:1.45;}

/* ── Blockquote ───────────────────────────────────────────────────────────── */
blockquote{
  border-left:3px solid ${P.primary};
  padding-left:10px;
  margin:.5em 0;
  color:${P.textSecondary};
  font-style:italic;
}

/* ── Table ────────────────────────────────────────────────────────────────── */
table{border-collapse:collapse;width:100%;margin:.5em 0;overflow-x:auto;display:block;}
th,td{border:1px solid ${P.border};padding:5px 9px;text-align:left;font-size:.9em;}
th{background:${P.surface};font-weight:600;}

/* ── HR ───────────────────────────────────────────────────────────────────── */
hr{border:none;height:1px;background:${P.border};margin:.7em 0;}

/* ── Display math — horizontal scroll for long equations ─────────────────── */
.math-block{
  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  margin:.6em 0;
  padding:2px 0;
  max-width:100%;
  /* Ensure scrollbar is accessible on iOS */
  -webkit-user-select:none;
  user-select:none;
}
.math-block .katex-display{
  margin:0;
  overflow-x:auto;
  overflow-y:hidden;
  padding:2px 4px;
  white-space:nowrap;
}

/* ── Inline math ──────────────────────────────────────────────────────────── */
.math-inline{display:inline;vertical-align:middle;}

/* ── KaTeX overflow guard ─────────────────────────────────────────────────── */
.katex{max-width:none;}
.katex-display>.katex{white-space:nowrap;}
.katex-display>.katex>.katex-html{overflow-x:auto;overflow-y:hidden;padding:2px 4px;}

/* ── Error fallback ───────────────────────────────────────────────────────── */
.math-err{color:${P.danger};font-size:.85em;}
</style>
</head>
<body>${body}<script>
(function(){
  function postHeight(){
    var h=document.documentElement.scrollHeight;
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'resize',height:h}));
    }
  }
  // Fire on load + small delay for KaTeX fonts
  window.addEventListener('load',function(){postHeight();setTimeout(postHeight,120);});
  // Fire on any DOM mutation (handles async rerenders)
  new MutationObserver(postHeight).observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true});
  // Fire on viewport change (orientation, etc.)
  window.addEventListener('resize',postHeight);
})();
</script></body>
</html>`;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Escape HTML special characters for safe inline display. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const plain = StyleSheet.create({
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: P.textPrimary,
    lineHeight: 28,
  },
  answer: {
    fontSize: 18,
    fontWeight: '400',
    color: P.textPrimary,
    lineHeight: 28,
  },
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
