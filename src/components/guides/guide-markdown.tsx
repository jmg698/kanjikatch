"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// Styled renderer for generated study guides. The guides are table-heavy
// GFM (vocabulary tables, kanji tables), so tables get their own scroll
// container to keep the page from overflowing on mobile.
const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg sm:text-xl font-bold tracking-tight mt-8 mb-3 pb-1.5 border-b">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base sm:text-lg font-semibold mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-lg border">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b px-3 py-2 text-left font-semibold whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-3 py-2 align-top">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-primary/30 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">{children}</code>
  ),
  a: ({ children, href }) => (
    <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

export function GuideMarkdown({ content }: { content: string }) {
  return (
    <div className="text-[15px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
