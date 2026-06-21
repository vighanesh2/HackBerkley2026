"use client";

import ReactMarkdown from "react-markdown";

type ChatMarkdownProps = {
  text: string;
};

export default function ChatMarkdown({ text }: ChatMarkdownProps) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gemini-accent underline underline-offset-2"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        hr: () => <hr className="my-3 border-gemini-border" />,
      }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
