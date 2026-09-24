import { describe, expect, it } from 'vitest';
import { previewText } from '~/lib/text';

describe('previewText', () => {
  it('drops emphasis markers but keeps the words', () => {
    expect(previewText('**Machine decision is due Friday.** Two quotes')).toBe(
      'Machine decision is due Friday. Two quotes',
    );
    expect(previewText('__bold__ and *italic* and _also_')).toBe('bold and italic and also');
    expect(previewText('~~struck~~ out')).toBe('struck out');
  });

  it('keeps link text and drops the URL', () => {
    expect(previewText('See [the drawing](https://example.com/d.pdf) first')).toBe(
      'See the drawing first',
    );
  });

  it('unwraps inline code and collapses fenced blocks', () => {
    expect(previewText('Run `npm ci` now')).toBe('Run npm ci now');
    expect(previewText('Before\n```ts\nconst a = 1;\n```\nafter')).toBe(
      'Before const a = 1; after',
    );
  });

  it('strips line-leading structure', () => {
    expect(previewText('# Heading\n> quoted\n- one\n- two\n1. first')).toBe(
      'Heading quoted one two first',
    );
  });

  it('flattens newlines and runs of whitespace into single spaces', () => {
    expect(previewText('a\n\n  b\tc')).toBe('a b c');
  });

  it('leaves characters that are not markup alone', () => {
    // An asterisk in arithmetic or a lone underscore in an identifier is
    // content, not emphasis, and must survive.
    expect(previewText('2 * 3 = 6')).toBe('2 * 3 = 6');
    expect(previewText('part_number KU_SLV')).toBe('part_number KU_SLV');
    expect(previewText('₹2.1 crore — 22 weeks')).toBe('₹2.1 crore — 22 weeks');
  });

  it('returns an empty string for empty input', () => {
    expect(previewText('')).toBe('');
  });
});
