import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import DOMPurify from "dompurify";
import "highlight.js/styles/github-dark.css";

// Initialize markdown-it with highlight.js
const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch {
        // ignore
      }
    }
    return `<pre class="hljs"><code>${MarkdownIt().utils.escapeHtml(str)}</code></pre>`;
  },
});

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className = "" }: MarkdownViewerProps) {
  const sanitizedHtml = useMemo(() => {
    const rawHtml = md.render(content);
    // Sanitize HTML to prevent XSS attacks
    return DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ["pre", "code"],
      ADD_ATTR: ["class"],
    });
  }, [content]);

  return (
    <div
      className={`markdown-viewer prose prose-invert prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
