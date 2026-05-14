import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { LegalLayout } from "@/components/legal/legal-layout";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Terms of Service — KanjiKatch",
  description: "Terms governing your use of KanjiKatch.",
};

const LAST_UPDATED = "May 14, 2026";

export default async function TermsPage() {
  const { userId } = await auth();
  return (
    <>
      <LegalLayout title="Terms of Service" lastUpdated={LAST_UPDATED} isSignedIn={Boolean(userId)}>
        <p>
          Welcome to KanjiKatch. These Terms of Service (&ldquo;Terms&rdquo;) form
          a binding agreement between you and KanjiKatch (&ldquo;KanjiKatch,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us&rdquo;) for your use of the KanjiKatch
          website, web app, and related services (collectively, the
          &ldquo;Service&rdquo;). By creating an account or otherwise using the
          Service, you agree to these Terms. If you do not agree, do not use the
          Service.
        </p>
        <p>
          These Terms reference our{" "}
          <Link href="/privacy">Privacy Policy</Link>, which is incorporated by
          reference.
        </p>

        <h2>1. The Service</h2>
        <p>
          KanjiKatch helps you build a Japanese-language review deck from
          materials you upload or paste (photos of pages, handwritten notes,
          text snippets). We use third-party AI services to extract kanji,
          vocabulary, and example sentences from your inputs, and we run a
          spaced-repetition system over the resulting deck. We may add, change,
          or remove Service features at any time.
        </p>

        <h2>2. Your account</h2>
        <p>
          You need an account to use most of the Service. Authentication is
          provided by our partner Clerk. You are responsible for keeping your
          credentials secure and for any activity on your account. You must be
          at least 13 years old (or the higher minimum age in your country) to
          use the Service. If you are using the Service on behalf of an
          organization, you represent that you have authority to bind that
          organization to these Terms.
        </p>

        <h2>3. Your content</h2>
        <p>
          &ldquo;Your Content&rdquo; means anything you submit to the Service,
          including images, pasted text, notes, ratings, and any edits or
          annotations you make.
        </p>
        <ul>
          <li>
            <strong>You own Your Content.</strong> Nothing in these Terms
            transfers ownership of Your Content to KanjiKatch.
          </li>
          <li>
            <strong>License to operate the Service.</strong> You grant
            KanjiKatch a worldwide, non-exclusive, royalty-free license to host,
            store, transmit, process, display, and create derivative works of
            Your Content solely to operate, secure, and improve the Service for
            you. We will not use Your Content to train general-purpose AI
            models, sell Your Content to third parties, or publish Your Content
            outside features you explicitly invoke (for example, &ldquo;Share
            your week&rdquo;).
          </li>
          <li>
            <strong>You are responsible for Your Content.</strong> You
            represent that you have the rights necessary to submit Your Content
            and that doing so does not violate any law or third-party right.
            Do not upload material you don&apos;t have the right to use; do not
            upload content that is illegal, infringing, or harmful.
          </li>
          <li>
            <strong>Image retention.</strong> Free-tier uploads are deleted
            from our image host after extraction. Pro-tier uploads are retained
            in your account so you can re-extract or revisit them. See our{" "}
            <Link href="/privacy">Privacy Policy</Link> for details.
          </li>
        </ul>

        <h2>4. AI processing</h2>
        <p>
          The Service uses third-party AI providers, including Anthropic, to
          extract Japanese text and to generate example sentences. When you
          submit content for extraction or sentence generation, that content
          (or a derived form, such as a list of target words) is sent to those
          providers under their terms and processed in their infrastructure.
        </p>
        <p>
          AI output is generated automatically and may be inaccurate, incomplete,
          or unexpected. The Service is a study aid, not a translation or
          interpretation service. Don&apos;t rely on its output for medical,
          legal, financial, safety-critical, or other consequential decisions.
          Always confirm anything important with a qualified human source.
        </p>

        <h2>5. Subscriptions, billing, and refunds</h2>
        <h3>Free tier</h3>
        <p>
          The free tier is available at no cost. Limits (such as monthly
          extractions and post-session sentence counts) are described on the{" "}
          <Link href="/pricing">pricing page</Link> and enforced in-product.
          We may change free-tier limits at any time, with notice for material
          reductions.
        </p>
        <h3>Pro subscription</h3>
        <p>
          Pro is a paid subscription billed monthly or annually. Current
          pricing is on the{" "}
          <Link href="/pricing">pricing page</Link>. Billing is handled by
          our partner Stripe; by starting a subscription, you agree to
          Stripe&apos;s terms in addition to ours.
        </p>
        <ul>
          <li>
            <strong>7-day free trial.</strong> Pro subscriptions begin with a
            7-day free trial. A payment method is required at signup. If you
            don&apos;t cancel before the trial ends, your card is charged for
            the first paid period.
          </li>
          <li>
            <strong>Renewal.</strong> Subscriptions auto-renew at the end of
            each billing period at the then-current price for that plan.
            You can cancel any time from the billing portal; cancellation takes
            effect at the end of the current period.
          </li>
          <li>
            <strong>Founder pricing.</strong> If you signed up at founder
            pricing, that rate is locked in for as long as your subscription
            remains continuously active. If you cancel and resubscribe later,
            you re-enter at the then-current standard price.
          </li>
          <li>
            <strong>Refunds.</strong> All charges are non-refundable, except
            where required by law. If you believe you were charged in error,
            email <a href="mailto:support@kanjikatch.com">support@kanjikatch.com</a>{" "}
            within 14 days and we&apos;ll review case-by-case.
          </li>
          <li>
            <strong>Failed payments.</strong> If a charge fails, we may suspend
            Pro features until the issue is resolved. Your cards, history, and
            already-generated audio remain intact.
          </li>
          <li>
            <strong>Taxes.</strong> Listed prices do not include taxes. You are
            responsible for any sales, VAT, GST, or similar taxes that may apply.
          </li>
        </ul>
        <h3>Fair use</h3>
        <p>
          &ldquo;Unlimited&rdquo; Pro features are intended for individual
          personal study. Heavy automation, scraping, redistribution, or
          team/shared use of a single account is not within fair use. We&apos;ll
          reach out before flagging legitimate usage; we reserve the right to
          throttle or terminate accounts that clearly exceed fair use.
        </p>

        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            Reverse engineer, scrape, or copy the Service except as permitted by law;
          </li>
          <li>Resell, sublicense, or expose the Service to third parties;</li>
          <li>
            Use the Service to generate or process content that is illegal,
            harmful, or that infringes third-party rights;
          </li>
          <li>
            Attempt to access another user&apos;s account or data, or otherwise
            circumvent our security measures;
          </li>
          <li>
            Use automated means (bots, scripts, scrapers) to access the Service
            beyond what a normal interactive user would, or to generate AI
            output in volume;
          </li>
          <li>
            Use the Service to train or evaluate competing AI models.
          </li>
        </ul>

        <h2>7. Account termination</h2>
        <p>
          You may delete your account at any time from the settings page. When
          you delete your account, your user record and all data linked to it
          (cards, vocabulary, sentences, review history, generated sentences,
          uploaded images) are deleted from our database; cached records may
          persist briefly on backup media before they roll off. We may retain
          anonymized usage and abuse-prevention logs as described in the
          Privacy Policy.
        </p>
        <p>
          We may suspend or terminate your account if you violate these Terms,
          if your account is dormant for an extended period, or if we are
          required to do so by law. Where we terminate without cause, we will
          provide a prorated refund of any unused prepaid period.
        </p>

        <h2>8. Intellectual property</h2>
        <p>
          KanjiKatch (the brand, app, software, and design) is owned by us and
          our licensors and is protected by intellectual-property laws. These
          Terms do not transfer any rights in the Service to you, except for
          the limited right to use the Service under these Terms.
        </p>
        <p>
          If you submit feedback, you grant us a non-exclusive, worldwide,
          royalty-free, irrevocable license to use that feedback to improve
          the Service. We don&apos;t owe you anything in return for feedback,
          but we appreciate it.
        </p>

        <h2>9. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
          WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT AI OUTPUT WILL BE
          ACCURATE OR COMPLETE.
        </p>

        <h2>10. Limitation of liability</h2>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, KANJIKATCH IS NOT LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL, ARISING
          OUT OF OR RELATED TO THESE TERMS OR THE SERVICE. OUR TOTAL LIABILITY
          ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE IS LIMITED
          TO THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE
          12 MONTHS BEFORE THE CLAIM, OR (B) US$50.
        </p>

        <h2>11. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless KanjiKatch from any
          claim, damage, or expense (including reasonable attorneys&apos; fees)
          arising out of (a) Your Content, (b) your use of the Service in
          violation of these Terms or applicable law, or (c) your violation of
          any third-party right.
        </p>

        <h2>12. Changes</h2>
        <p>
          We may update these Terms from time to time. If we make material
          changes, we&apos;ll notify you by email or in-product before they take
          effect. Your continued use of the Service after changes take effect
          means you accept the updated Terms.
        </p>

        <h2>13. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of the State of California,
          excluding conflict-of-laws rules. The parties consent to exclusive
          jurisdiction and venue of the state and federal courts located in
          San Francisco County, California, for any dispute that is not
          subject to mandatory arbitration under applicable consumer-protection
          law.
        </p>

        <h2>14. Contact</h2>
        <p>
          Questions, requests, and notices under these Terms should be sent
          to{" "}
          <a href="mailto:support@kanjikatch.com">
            support@kanjikatch.com
          </a>
          .
        </p>
      </LegalLayout>
      <SiteFooter />
    </>
  );
}
