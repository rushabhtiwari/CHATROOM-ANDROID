/**
 * One line of readable text from a message's markdown source.
 *
 * Messages are stored as markdown and rendered by the console's
 * MarkdownContent. Anywhere a message is *summarised* instead — a list row, the
 * pinned banner, a reply quote — there is one truncated line and no renderer,
 * so the source has to be flattened or the reader sees literal asterisks.
 *
 * The chat store's `plainText` does not do this: it resolves mention tokens to
 * names and leaves formatting alone. The two compose — mentions first, then
 * this — and neither can stand in for the other.
 *
 * Deliberately conservative. Every pattern requires markup-shaped input: an
 * emphasis marker has to hug a non-space on the inside, and an underscore has
 * to sit at a word boundary. Content that merely contains the same characters —
 * `2 * 3`, `KU_SLV` — is left exactly as written.
 */
export function previewText(markdown: string): string {
  return (
    markdown
      // Fenced blocks: keep the code, drop the fences and the language tag.
      .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
      // Inline code.
      .replace(/`([^`\n]+)`/g, '$1')
      // Images before links, since an image is a link with a `!` in front.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Line-leading structure: headings, quotes, bullets, numbered items.
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
      .replace(/^[ \t]*>[ \t]?/gm, '')
      .replace(/^[ \t]*[-*+][ \t]+/gm, '')
      .replace(/^[ \t]*\d+[.)][ \t]+/gm, '')
      // Emphasis, strongest first so `**x**` is not read as two `*x*`.
      .replace(/\*\*(\S(?:[\s\S]*?\S)?)\*\*/g, '$1')
      .replace(/(^|\W)__(\S(?:[\s\S]*?\S)?)__(?=\W|$)/g, '$1$2')
      .replace(/~~(\S(?:[\s\S]*?\S)?)~~/g, '$1')
      .replace(/\*(\S(?:[^*]*?\S)?)\*/g, '$1')
      .replace(/(^|\W)_(\S(?:[^_]*?\S)?)_(?=\W|$)/g, '$1$2')
      // A summary is one line.
      .replace(/\s+/g, ' ')
      .trim()
  );
}
