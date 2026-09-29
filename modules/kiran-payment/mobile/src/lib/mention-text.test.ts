import { describe, expect, it } from 'vitest';
import type { User, UserGroup } from '@/lib/chat-types';
import type { MentionCandidate } from '@/lib/mentions';
import { decodeMentions, encodeMentions, mentionLabel, type MentionMap } from '~/lib/mention-text';

const users = [
  { id: 'u5', name: 'Imran Shaikh' },
  { id: 'u7', name: 'Priya Kapoor' },
  { id: 'u8', name: 'Priya' },
] as User[];
const groups = [{ id: 'g1', handle: 'engineering', name: 'Engineering' }] as UserGroup[];

describe('mentionLabel', () => {
  it('shows a person by name and a group or broadcast by its handle', () => {
    expect(
      mentionLabel({ kind: 'user', label: 'Imran Shaikh', token: '<@u5>' } as MentionCandidate),
    ).toBe('@Imran Shaikh');
    expect(
      mentionLabel({
        kind: 'group',
        label: '@engineering',
        token: '<!engineering>',
      } as MentionCandidate),
    ).toBe('@engineering');
    expect(
      mentionLabel({ kind: 'agent', label: '@agent', token: '@agent' } as MentionCandidate),
    ).toBe('@agent');
  });
});

describe('decodeMentions / encodeMentions', () => {
  it('round-trips stored text through what the composer shows', () => {
    const map: MentionMap = new Map();
    const stored = 'Ask <@u5> and <!engineering>, cc <!channel>';
    const shown = decodeMentions(stored, users, groups, map);
    expect(shown).toBe('Ask @Imran Shaikh and @engineering, cc @channel');
    expect(encodeMentions(shown, map)).toBe(stored);
  });

  it('leaves the token of someone no longer in the directory alone', () => {
    const map: MentionMap = new Map();
    expect(decodeMentions('ping <@u99>', users, groups, map)).toBe('ping <@u99>');
    expect(map.size).toBe(0);
  });

  it('prefers the longer name, so a surname is not left behind', () => {
    const map: MentionMap = new Map([
      ['@Priya', '<@u8>'],
      ['@Priya Kapoor', '<@u7>'],
    ]);
    expect(encodeMentions('@Priya Kapoor and @Priya', map)).toBe('<@u7> and <@u8>');
  });

  it('only converts a name standing on its own', () => {
    const map: MentionMap = new Map([['@Imran Shaikh', '<@u5>']]);
    expect(encodeMentions('mail imran@Imran Shaikh', map)).toBe('mail imran@Imran Shaikh');
    expect(encodeMentions('@Imran Shaikhs', map)).toBe('@Imran Shaikhs');
    expect(encodeMentions("@Imran Shaikh's report", map)).toBe("<@u5>'s report");
  });

  it('leaves text with no picked names exactly as written', () => {
    expect(encodeMentions('Typed @Imran by hand', new Map())).toBe('Typed @Imran by hand');
  });
});
