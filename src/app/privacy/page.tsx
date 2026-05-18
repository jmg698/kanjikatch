import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — KanjiKatch",
  description: "What KanjiKatch collects, how we use it, and the subprocessors we rely on.",
};

const EFFECTIVE_DATE = "May 18, 2026";
const SUPPORT_EMAIL = "support@kanjikatch.com";

const SUBPROCESSORS: Array<{
  name: string;
  purpose: string;
  data: string;
  link?: string;
}> = [
  {
    name: "Clerk",
    purpose: "User authentication and session management",
    data: "Email, name, OAuth identifiers, hashed credentials, session tokens",
    link: "https://clerk.com/legal/privacy",
  },
  {
    name: "Neon",
    purpose: "Managed PostgreSQL database hosting",
    data: "All application data: account record, kanji, vocabulary, sentences, review history, subscription state",
    link: "https://neon.tech/privacy-policy",
  },
  {
    name: "Anthropic",
    purpose: "AI extraction and sentence generation (Claude API)",
    data: "Uploaded images and pasted text, sent at the moment of extraction; learner study items, sent when generating personalized sentences",
    link: "https://www.anthropic.com/legal/privacy",
  },
  {
    name: "Uploadthing",
    purpose: "Image upload pipeline and storage",
    data: "Uploaded images and associated metadata",
    link: "https://uploadthing.com/legal/privacy",
  },
  {
    name: "Sentry",
    purpose: "Error tracking and performance monitoring",
    data: "Error messages, stack traces, request metadata, anonymous user identifier",
    link: "https://sentry.io/privacy/",
  },
  {
    name: "Stripe",
    purpose: "Payment processing and subscription billing",
    data: "Payment method, billing address, subscription state. We do not store full card numbers on our servers.",
    link: "https://stripe.com/privacy",
  },
  {
    name: "Resend",
    purpose: "Transactional email delivery (welcome, billing, study reminders, session recaps)",
    data: "Email address, message content. Used only for transactional and operational emails — never sold or used for third-party marketing.",
    link: "https://resend.com/legal/privacy-policy",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="font-serif text-2xl text-primary leading-none">漢字</span>
            <span className="font-display text-xl font-semibold tracking-tight">
              KanjiKatch
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Home
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-12 max-w-3xl">
        <h1 className="font-display text-4xl font-bold tracking-tight mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="space-y-6 text-[15px] leading-relaxed">
          <Section title="1. The short version">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>We collect the minimum needed to operate the Service.</li>
              <li>We do not sell your data, ever.</li>
              <li>
                We do not use your uploads or study content to train AI models.
              </li>
              <li>
                You can export everything as JSON and delete your account at any
                time from the Settings page.
              </li>
            </ul>
          </Section>

          <Section title="2. What we collect">
            <p>
              <strong>Account information.</strong> When you sign up we record
              your email address and (via Clerk) any profile details you choose
              to provide. We assign you a Clerk user ID which we use as the
              primary key for everything you create.
            </p>
            <p>
              <strong>Content you upload or create.</strong> Images you capture,
              text you paste, kanji and vocabulary added to your library,
              sentences generated for your review sessions, your review history,
              and your difficulty ratings.
            </p>
            <p>
              <strong>Subscription information.</strong> If you start a paid
              subscription, Stripe stores your billing details. We store your
              Stripe customer and subscription identifiers, the current
              subscription status, the price you are on, the current period end,
              and trial end. We never receive or store your full card number.
            </p>
            <p>
              <strong>Operational logs.</strong> We log per-request AI usage
              (model name, input/output token counts, estimated cost,
              timestamp) so we can enforce per-user and global cost limits.
              These logs include your user identifier and a hashed IP address;
              we never store the raw IP. AI usage records may be retained after
              account deletion in anonymized form (your user identifier is
              detached) so that cost analytics remain accurate over time.
            </p>
            <p>
              <strong>Error reports.</strong> When the application crashes, we
              send the error message, stack trace, and request metadata to
              Sentry. Sentry receives an anonymous user identifier so we can
              correlate errors per user, but not your email or content.
            </p>
            <p>
              <strong>Issue reports.</strong> If you submit a report via the
              &quot;Report this issue&quot; button, we record the report
              category, your note, your user agent, and (when applicable) the
              identifier of the source image you were working with.
            </p>
            <p>
              We do <em>not</em> use third-party analytics or advertising
              trackers. If we add product analytics in the future (e.g. PostHog),
              we will update this Policy and disclose it in-app before turning
              it on.
            </p>
          </Section>

          <Section title="3. How we use your information">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>To operate the core learning loop (extract, store, review).</li>
              <li>
                To bill you, if you are a paid subscriber, and to honor your
                cancellations and refunds.
              </li>
              <li>
                To send transactional email: welcome, billing receipts, payment
                failures, study reminders, and (for Pro) session recap emails.
              </li>
              <li>
                To enforce free-tier limits and protect the Service from
                abuse, including AI cost limits and per-IP throttles.
              </li>
              <li>
                To debug crashes and fix bugs (via Sentry error reports).
              </li>
              <li>
                To contact you about substantive changes to the Service, Terms,
                or this Policy.
              </li>
            </ul>
          </Section>

          <Section title="4. AI processing">
            <p>
              When you upload an image or paste text, we send it to Anthropic
              (Claude) to extract kanji, vocabulary, and sentences. When you
              start a sentence-generation request, we send a small payload
              describing the target items to Anthropic for generation.
            </p>
            <p>
              We configure our AI providers to disable training on the data we
              send them where that option is available. We do not train any AI
              models ourselves.
            </p>
          </Section>

          <Section title="5. Data retention">
            <p>
              <strong>Free tier images.</strong> Deleted from Uploadthing after
              extraction completes. The extracted kanji, vocabulary, and
              sentences remain in your library.
            </p>
            <p>
              <strong>Pro tier images.</strong> Retained while your subscription
              is active so that you can re-extract or browse history. Deleted
              shortly after subscription cancellation or account deletion.
            </p>
            <p>
              <strong>Library, review history, generated sentences.</strong>{" "}
              Retained as long as your account is active. Preserved across Pro
              cancellation so you do not lose progress if you resubscribe.
            </p>
            <p>
              <strong>Billing records.</strong> Subscription history and
              invoices are retained for as long as required by tax and
              accounting law (typically 7 years), even after account deletion.
              These records do not include your library content.
            </p>
            <p>
              <strong>AI usage events.</strong> Retained indefinitely in a form
              that may be detached from your account on deletion. Used only for
              cost analytics and circuit-breaker enforcement.
            </p>
          </Section>

          <Section title="6. Your rights">
            <p>
              You can <strong>export</strong> all your data as a JSON file from
              Settings → Export data.
            </p>
            <p>
              You can <strong>delete</strong> your account from Settings →
              Delete account. Deletion permanently removes your account record,
              library, sentences, review history, source images, and
              subscription record from our active systems. Cascade deletion runs
              immediately. Stripe and Uploadthing retain copies according to
              their own retention windows; see their privacy policies linked
              below.
            </p>
            <p>
              If you reside in a jurisdiction with applicable data-protection
              law (e.g. GDPR, UK GDPR, CCPA), you may have additional rights
              including access, correction, portability, restriction of
              processing, and objection. To exercise these rights, email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-primary hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="7. Subprocessors">
            <p>
              The Service relies on the following third parties to operate. Each
              link below points to their own privacy policy.
            </p>
            <div className="not-prose overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-left">
                    <th className="font-medium py-2 pr-4">Provider</th>
                    <th className="font-medium py-2 pr-4">Purpose</th>
                    <th className="font-medium py-2">Data shared</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((sp) => (
                    <tr
                      key={sp.name}
                      className="border-b border-border/40 align-top"
                    >
                      <td className="py-3 pr-4 font-medium whitespace-nowrap">
                        {sp.link ? (
                          <a
                            href={sp.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {sp.name}
                          </a>
                        ) : (
                          sp.name
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {sp.purpose}
                      </td>
                      <td className="py-3 text-muted-foreground">{sp.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              If we change subprocessors in a way that materially affects how
              your data is processed, we will update this list and notify
              active users by email.
            </p>
          </Section>

          <Section title="8. Cookies">
            <p>
              We use a minimal set of strictly-necessary cookies for
              authentication (set by Clerk) and session security. We do not use
              advertising or cross-site tracking cookies. If we add optional
              analytics in the future, we will surface a cookie disclosure and
              an opt-out before doing so.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              The Service is not directed to children under 13. We do not
              knowingly collect personal information from anyone under 13. If
              you believe a child has signed up, email {SUPPORT_EMAIL} and we
              will delete the account.
            </p>
          </Section>

          <Section title="10. Security">
            <p>
              All data is transmitted over HTTPS. Database credentials and API
              keys are stored as encrypted environment variables. Authentication
              is handled by Clerk. Payment data is handled by Stripe. No system
              is perfectly secure; if you discover a vulnerability, please
              report it to {SUPPORT_EMAIL}.
            </p>
          </Section>

          <Section title="11. Changes to this Policy">
            <p>
              We may update this Policy from time to time. If a change is
              material, we will notify active users by email at least 14 days
              before it takes effect. The &quot;Effective&quot; date at the top
              of this page reflects the current version.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Privacy questions or requests? Email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-primary hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 text-sm text-muted-foreground">
          See also:{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
