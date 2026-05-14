import Link from "next/link";

// Shared site footer. Used by the landing page, pricing, and the legal
// pages. The dashboard intentionally does not render this — the in-app
// chrome has its own nav and a footer would clutter the review surface.
export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="container mx-auto px-4 sm:px-6 py-10">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-10 items-start">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-xl text-primary">漢字</span>
              <span className="font-display font-semibold">KanjiKatch</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
              Built for Japanese learners who want a review deck that follows
              what they actually read.
            </p>
          </div>
          <FooterColumn
            heading="Product"
            links={[
              { label: "How it works", href: "/#how" },
              { label: "In the wild", href: "/#wild" },
              { label: "Pricing", href: "/pricing" },
              { label: "FAQ", href: "/#faq" },
            ]}
          />
          <FooterColumn
            heading="Legal"
            links={[
              { label: "Terms of Service", href: "/terms" },
              { label: "Privacy Policy", href: "/privacy" },
            ]}
          />
          <FooterColumn
            heading="Support"
            links={[
              { label: "support@kanjikatch.com", href: "mailto:support@kanjikatch.com" },
            ]}
          />
        </div>
        <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} KanjiKatch. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built for Japanese learners. Made by humans.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
        {heading}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(({ label, href }) => (
          <li key={href}>
            <Link
              href={href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
