import { describe, expect, it } from 'vitest';

import { buildRichTextHtml, hasRichContent } from './rich-text-html';

describe('hasRichContent', () => {
  it('returns false for plain text', () => {
    expect(hasRichContent('What is mitosis?')).toBe(false);
  });

  it('returns true for markdown bold', () => {
    expect(hasRichContent('This is **bold**')).toBe(true);
  });

  it('returns true for LaTeX inline', () => {
    expect(hasRichContent('Formula $E=mc^2$')).toBe(true);
  });

  it('returns true for headings', () => {
    expect(hasRichContent('# Title')).toBe(true);
  });
});

describe('buildRichTextHtml', () => {
  it('wraps plain text in <p> tags', () => {
    const html = buildRichTextHtml('Hello world', 'question');
    expect(html).toContain('<p>Hello world</p>');
  });

  it('renders bold markdown', () => {
    const html = buildRichTextHtml('This is **bold** text', 'answer');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('renders italic markdown', () => {
    const html = buildRichTextHtml('This is *italic* text', 'answer');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders headings', () => {
    const html = buildRichTextHtml('# Title\n\nParagraph', 'question');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Paragraph</p>');
  });

  it('renders code blocks', () => {
    const html = buildRichTextHtml('Use `console.log()`', 'answer');
    expect(html).toContain('<code>console.log()</code>');
  });

  it('renders blockquotes', () => {
    const html = buildRichTextHtml('> Important note', 'answer');
    expect(html).toContain('<blockquote>');
  });

  it('renders unordered lists', () => {
    const html = buildRichTextHtml('- Item A\n- Item B', 'answer');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Item A</li>');
  });

  it('renders inline LaTeX', () => {
    const html = buildRichTextHtml('The formula $E=mc^2$ is famous', 'question');
    expect(html).toContain('class="math-inline"');
    expect(html).toContain('katex');
    // Raw delimiter should be gone
    expect(html).not.toContain('$E=mc^2$');
  });

  it('renders display LaTeX', () => {
    const html = buildRichTextHtml('Equation:\n$$\\int_0^1 x^2 dx$$', 'answer');
    expect(html).toContain('class="math-display"');
  });

  it('handles mixed markdown and LaTeX', () => {
    const source = "# Derivative\n\nThe **derivative** of $f(x) = x^2$ is $f'(x) = 2x$.";
    const html = buildRichTextHtml(source, 'question');
    expect(html).toContain('<h1>');
    expect(html).toContain('<strong>derivative</strong>');
    expect(html).toContain('class="math-inline"');
  });

  it('handles malformed LaTeX gracefully (no throw)', () => {
    const html = buildRichTextHtml('Bad: $\\invalid{$', 'answer');
    expect(html).toBeDefined();
    // KaTeX with throwOnError:false renders error spans rather than throwing
    expect(html).toContain('katex');
  });

  it('applies question variant font size 20px bold', () => {
    const html = buildRichTextHtml('test', 'question');
    expect(html).toContain('font-size:20px');
    expect(html).toContain("font-weight:700");
  });

  it('applies answer variant font size 18px normal', () => {
    const html = buildRichTextHtml('test', 'answer');
    expect(html).toContain('font-size:18px');
    expect(html).toContain("font-weight:400");
  });

  it('includes overflow protection CSS', () => {
    const html = buildRichTextHtml('test', 'question');
    expect(html).toContain('overflow-x:hidden');
    expect(html).toContain('break-word');
  });

  it('includes KaTeX CSS', () => {
    const html = buildRichTextHtml('$x$', 'question');
    expect(html).toContain('.katex');
  });

  it('includes height reporting script', () => {
    const html = buildRichTextHtml('test', 'question');
    expect(html).toContain('ReactNativeWebView');
    expect(html).toContain('resize');
  });

  it('renders display math before inline to avoid conflicts', () => {
    const source = '$$a + b$$ and $c$';
    const html = buildRichTextHtml(source, 'answer');
    expect(html).toContain('class="math-display"');
    expect(html).toContain('class="math-inline"');
  });

  it('handles Chinese text correctly', () => {
    const html = buildRichTextHtml('线粒体是细胞的**能量工厂**', 'question');
    expect(html).toContain('线粒体是细胞的');
    expect(html).toContain('<strong>能量工厂</strong>');
  });
});
