import Link from "next/link";

export const metadata = {
  title: "Terms of Service — KanjiKatch",
  description: "The terms governing your use of KanjiKatch.",
};

const EFFECTIVE_DATE = "May 18, 2026";
const SUPPORT_EMAIL = "support@kanjikatch.com";

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="prose prose-neutral max-w-none space-y-6 text-[15px] leading-relaxed">
          <section>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access to and use
              of KanjiKatch (the &quot;Service&quot;), operated by the KanjiKatch team
              (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account or using
              the Service, you agree to these Terms. If you do not agree, do not use
              the Service.
            </p>
          </section>

          <Section title="1. Eligibility and account">
            <p>
              You must be at least 13 years old to use the Service. You are
              responsible for the security of your account credentials and for any
              activity that occurs under your account. We use Clerk to manage
              authentication; their handling of your credentials is governed by
              their own terms and privacy policy.
            </p>
          </Section>

          <Section title="2. Your content">
            <p>
              The Service lets you upload images, paste text, and generate study
              material derived from them (collectively, &quot;Your Content&quot;).
              You retain ownership of Your Content. You grant us a limited,
              worldwide, royalty-free license to host, process, and display Your
              Content solely to operate, improve, and support the Service.
            </p>
            <p>
              You are responsible for ensuring you have the right to use any
              content you upload. Do not upload material that infringes third-party
              rights, violates applicable law, or contains content you are not
              permitted to share.
            </p>
            <p>
              Free-tier images are deleted after extraction is complete. Pro-tier
              images are retained while your subscription is active so that you
              can re-extract or browse history. See the Privacy Policy for the
              full retention schedule.
            </p>
          </Section>

          <Section title="3. AI processing">
            <p>
              The Service uses third-party AI providers (currently Anthropic) to
              extract kanji, vocabulary, and sentences from your uploads, and to
              generate example sentences for review. AI output is probabilistic
              and may contain errors. You should not rely on AI output for
              high-stakes use cases (translation of legal, medical, or financial
              documents, etc.).
            </p>
            <p>
              We do not use your uploads or generated content to train AI models,
              and we configure our AI providers to disable training on the data we
              send them where that option is available.
            </p>
          </Section>

          <Section title="4. Subscriptions, billing, and refunds">
            <p>
              The Service offers a free tier and a paid &quot;Pro&quot; tier. Pro
              is billed monthly or annually through Stripe. By starting a paid
              subscription, you authorize us (via Stripe) to charge your payment
              method on a recurring basis until you cancel.
            </p>
            <p>
              <strong>Trials.</strong> If you start a free trial, your card will
              not be charged until the trial period ends. You can cancel at any
              time during the trial through the billing portal; cancellation
              before the trial ends will not result in a charge.
            </p>
            <p>
              <strong>Cancellation.</strong> You can cancel at any time. Your Pro
              access continues through the end of the current billing period; we
              do not pro-rate refunds for partial months.
            </p>
            <p>
              <strong>Refunds.</strong> We offer refunds within 14 days of an
              initial purchase if you are dissatisfied with the Service. Renewal
              charges are non-refundable, but you can cancel future renewals at
              any time. To request a refund, email {SUPPORT_EMAIL}.
            </p>
            <p>
              <strong>Founders pricing.</strong> If you subscribed under a
              promotional &quot;Founders&quot; rate, that rate applies for as long
              as your subscription remains continuously active. If you cancel and
              later resubscribe, the then-current standard rate applies.
            </p>
            <p>
              <strong>Price changes.</strong> We may change pricing for new
              subscriptions at any time. Existing subscribers will be given at
              least 30 days&apos; notice by email before any price increase applies
              to their renewal.
            </p>
          </Section>

          <Section title="5. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service to violate any law or third-party right.</li>
              <li>
                Upload content that is illegal, harmful, defamatory, obscene, or
                infringing.
              </li>
              <li>
                Attempt to reverse-engineer, scrape, or programmatically extract
                data from the Service outside the data-export endpoints we
                provide.
              </li>
              <li>
                Attempt to bypass plan limits or share an account with multiple
                people. &quot;Unlimited&quot; Pro use is subject to a fair-use
                policy intended for one person&apos;s personal study; we may
                contact you, throttle, or terminate accounts whose usage pattern
                indicates automated or shared use.
              </li>
              <li>
                Interfere with the Service&apos;s integrity, including by
                attempting to exhaust paid AI resources, probing security, or
                circumventing rate limits.
              </li>
            </ul>
          </Section>

          <Section title="6. Service availability and changes">
            <p>
              We aim to keep the Service available but do not guarantee any
              specific uptime. We may modify, suspend, or discontinue any part of
              the Service at any time. If we discontinue a paid feature you are
              actively paying for, we will refund the pro-rated unused portion.
            </p>
          </Section>

          <Section title="7. Termination">
            <p>
              You may terminate your account at any time via the Settings page,
              which permanently deletes your account and associated data. We may
              suspend or terminate accounts that violate these Terms, abuse the
              Service, or charge back legitimate payments. On termination by us
              for cause, no refund is owed.
            </p>
          </Section>

          <Section title="8. Disclaimers">
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot;,
              without warranties of any kind, whether express or implied,
              including merchantability, fitness for a particular purpose, and
              non-infringement. We do not warrant that the Service will be
              uninterrupted, error-free, or that AI-generated content will be
              accurate.
            </p>
          </Section>

          <Section title="9. Limitation of liability">
            <p>
              To the maximum extent permitted by law, in no event will KanjiKatch
              be liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits, revenues, data, or
              goodwill, arising out of your use of the Service. Our aggregate
              liability for any claim arising out of or relating to the Service
              will not exceed the greater of (a) the amounts you paid us in the
              twelve months preceding the claim or (b) USD $50.
            </p>
          </Section>

          <Section title="10. Indemnification">
            <p>
              You agree to indemnify and hold KanjiKatch harmless from any claim,
              demand, or damages arising out of your breach of these Terms, your
              violation of any law, or your infringement of any third-party
              right.
            </p>
          </Section>

          <Section title="11. Changes to these Terms">
            <p>
              We may update these Terms from time to time. If a change is
              material, we will notify you by email or in-app notice at least
              14 days before it takes effect. Continued use of the Service after
              the effective date constitutes acceptance.
            </p>
          </Section>

          <Section title="12. Governing law">
            <p>
              These Terms are governed by the laws of the jurisdiction in which
              KanjiKatch is operated, without regard to conflict-of-law
              principles. Any dispute will be resolved in the courts located in
              that jurisdiction.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Questions about these Terms? Email{" "}
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
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
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
