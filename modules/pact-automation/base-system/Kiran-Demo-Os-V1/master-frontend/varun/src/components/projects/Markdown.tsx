/**
 * Markdown for work item descriptions and comments.
 *
 * The chat module has its own renderer, but it is built around mention tokens
 * and needs a user directory, a group list and a current-user id to render at
 * all. Work items have none of those, so this is the plain version — same
 * security posture, none of the chat coupling.
 *
 * Security: `react-markdown` compiles to React elements and does not pass raw
 * HTML through unless `rehype-raw` is added, which it deliberately is not. So
 * there is no `dangerouslySetInnerHTML` anywhere in this path and a description
 * containing `<img onerror=…>` renders as literal text. Anchors are validated
 * against an http(s) allowlist and images are disabled outright.
 */

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isSafeHref } from '@/lib/link-preview';

const PLUGINS = [remarkGfm];

function MarkdownImpl({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div className={`md-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={PLUGINS}
        disallowedElements={['img']}
        unwrapDisallowed
        components={{
          a({ href, children, node, ...rest }) {
            void node;
            if (!href || !isSafeHref(href)) return <span {...rest}>{children}</span>;
            return (
              <a
                {...rest}
                href={href}
                target="_blank"
                // Without noopener the opened page keeps a live window.opener
                // handle back into this origin.
                rel="noopener noreferrer nofollow ugc"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
