/**
 * Mentions as the writer sees them, and as they are stored.
 *
 * A message stores a mention as `<@u5>` so that renaming someone never breaks
 * an old one. Nobody should have to read that while typing, though: the
 * composer shows "@Imran Shaikh" and remembers which token each name it
 * inserted stands for. These two convert at the edges — a draft or a
 * handed-over reply coming in, a message or a draft going out.
 *
 * Only names the composer put there are converted back. A name typed by hand
 * stays text, which is what it was before; the notification parser reads
 * hand-typed `@Name` mentions on its own.
 */
import type { User, UserGroup } from '@/lib/chat-types';
import { SPECIAL_TOKEN, USER_TOKEN, type MentionCandidate } from '@/lib/mentions';

/** Name shown → token stored. */
export type MentionMap = Map<string, string>;

/** What the composer shows for a picked candidate: the person's name, or the handle. */
export const mentionLabel = (candidate: MentionCandidate): string =>
  candidate.kind === 'user' ? `@${candidate.label}` : candidate.label;

/** Stored text to what the composer shows, recording each token it replaced. */
export function decodeMentions(
  text: string,
  users: User[],
  groups: UserGroup[],
  map: MentionMap,
): string {
  return text
    .replace(USER_TOKEN, (token, id: string) => {
      const user = users.find((candidate) => candidate.id === id);
      if (!user) return token; // Someone who has left: better a token than a wrong name.
      map.set(`@${user.name}`, token);
      return `@${user.name}`;
    })
    .replace(SPECIAL_TOKEN, (token, handle: string) => {
      const group = groups.find((candidate) => candidate.handle === handle);
      const label = `@${group ? group.handle : handle}`;
      map.set(label, token);
      return label;
    });
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * What the composer shows back to the stored form.
 *
 * Longest name first, so "@Priya Kapoor" is not read as "@Priya" plus a
 * surname. A name only counts on its own: not inside a word or an address
 * (`me@x`), and not followed by more of a word (`@Imran Shaikhs`).
 */
export function encodeMentions(text: string, map: MentionMap): string {
  const labels = [...map.keys()].sort((a, b) => b.length - a.length);
  return labels.reduce((out, label) => {
    const token = map.get(label)!;
    if (token === label) return out;
    return out.replace(new RegExp(`(?<![\\w<@])${escape(label)}(?![\\w-])`, 'g'), () => token);
  }, text);
}
