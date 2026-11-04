import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { slugifyHeading } from "@/lib/help-center";

// Renders a help article. Headings get anchor ids (matching the table of
// contents), internal links stay client-side, and blockquotes — which the
// articles use for "Tip:" / "Note:" / "Important:" asides — become callouts.

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

const components: Components = {
  h2: ({ children }) => (
    <h2
      id={slugifyHeading(textOf(children))}
      className="font-display text-xl sm:text-2xl font-semibold tracking-tight mt-12 mb-4 scroll-mt-24"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      id={slugifyHeading(textOf(children))}
      className="text-base sm:text-lg font-semibold mt-8 mb-2 scroll-mt-24"
    >
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-3 pl-6 list-disc space-y-1.5 marker:text-muted-foreground">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-4 pl-6 list-decimal space-y-2.5 marker:font-semibold marker:text-primary">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-5 rounded-lg border">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => <th className="border-b px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/60 px-3 py-2 align-top">{children}</td>,
  blockquote: ({ children }) => (
    <aside className="my-5 flex gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-1 text-[15px]">
      <Info className="mt-4 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="[&>p]:my-3">{children}</div>
    </aside>
  ),
  hr: () => <hr className="my-10 border-border" />,
  code: ({ children }) => <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] font-mono">{children}</code>,
  a: ({ children, href = "" }) => {
    const className = "font-medium text-primary underline underline-offset-2 hover:no-underline";
    if (href.startsWith("/")) {
      return (
        <Link href={href} className={className}>
          {children}
        </Link>
      );
    }
    if (href.startsWith("mailto:")) {
      return (
        <a href={href} className={className}>
          {children}
        </a>
      );
    }
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
};

export function HelpMarkdown({ content }: { content: string }) {
  return (
    <div className="text-[15.5px] text-foreground/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
