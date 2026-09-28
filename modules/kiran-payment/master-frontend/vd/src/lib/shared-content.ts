import type { LinkPreview, SharedMessage } from "./chat-types";
import { isMediaAttachment } from "./attachments";

export interface SharedLink {
  message: SharedMessage;
  preview: LinkPreview;
}

export interface SharedContent {
  media: SharedMessage[];
  docs: SharedMessage[];
  links: SharedLink[];
}

const URL_PATTERN = /https?:\/\/[^\s<>()[\]"']+[^\s<>()[\]"'.,;:!?]/g;

/** Bare URLs in a message's text, for messages whose previews never loaded. */
export function urlsIn(content: string): string[] {
  return [...new Set(content.match(URL_PATTERN) ?? [])];
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * What a conversation has shared: photos and videos, documents, and links.
 *
 * Links come from the message's previews when it has them, and otherwise from
 * the URLs in its text — a link whose preview could not be fetched was still
 * shared, and leaving it out made "Links" read as empty when it was not.
 * Newest first, the order you look for something you just saw.
 */
export function sharedContentOf(messages: readonly SharedMessage[]): SharedContent {
  const live = messages
    .filter((message) => !message.deletedAt && !message.system && !message.scheduledFor)
    .sort((a, b) => b.timestamp - a.timestamp);

  const media: SharedMessage[] = [];
  const docs: SharedMessage[] = [];
  const links: SharedLink[] = [];
  for (const message of live) {
    if (message.attachment) {
      (isMediaAttachment(message.attachment) ? media : docs).push(message);
    }
    const previews = message.linkPreviews ?? [];
    const previewed = new Set(previews.map((preview) => preview.url));
    for (const preview of previews) links.push({ message, preview });
    for (const url of urlsIn(message.content)) {
      if (!previewed.has(url)) links.push({ message, preview: { url, title: hostOf(url) } });
    }
  }
  return { media, docs, links };
}

export const sharedItemCount = (content: SharedContent) =>
  content.media.length + content.docs.length + content.links.length;
