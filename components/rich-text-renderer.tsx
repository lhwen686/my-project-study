import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Palette } from '@/constants/design-tokens';
import { buildRichTextHtml, hasRichContent, type RichTextVariant } from '@/services/rich-text-html';

type Props = {
  /** Raw markdown + LaTeX source string (the card's front or back). */
  content: string;
  /** Controls typography weight/size: question = 20px bold, answer = 18px normal. */
  variant: RichTextVariant;
  /** Optional additional styles on the outer container. */
  style?: ViewStyle;
};

const MIN_HEIGHT = 24;
const FALLBACK_HEIGHT = 60;

/**
 * Black-box component that renders Markdown + LaTeX content.
 *
 * For plain-text cards (no markdown / LaTeX syntax detected) it renders a
 * native `<Text>` for zero-overhead. For rich content it uses a WebView
 * with pre-rendered HTML produced by markdown-it + KaTeX.
 */
export function RichTextRenderer({ content, variant, style }: Props) {
  // ── Fast path: plain text ──────────────────────────────────────────────────
  if (!hasRichContent(content)) {
    return (
      <Text style={[variant === 'question' ? plain.question : plain.answer, style as TextStyle]}>
        {content}
      </Text>
    );
  }

  // ── Rich path: WebView ─────────────────────────────────────────────────────
  return <RichWebView content={content} variant={variant} style={style} />;
}

// Extracted to its own component so the hooks are unconditional.
function RichWebView({ content, variant, style }: Props) {
  const [height, setHeight] = useState(FALLBACK_HEIGHT);

  const html = useMemo(() => buildRichTextHtml(content, variant), [content, variant]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'resize' && typeof data.height === 'number') {
        setHeight(Math.max(MIN_HEIGHT, Math.ceil(data.height)));
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  return (
    <View style={[styles.container, { height }, style]}>
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
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const plain = StyleSheet.create({
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: Palette.textPrimary,
    lineHeight: 28,
  },
  answer: {
    fontSize: 18,
    fontWeight: '400',
    color: Palette.textPrimary,
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
    backgroundColor: 'transparent',
  },
});
