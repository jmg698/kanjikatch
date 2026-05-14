import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { LegalLayout } from "@/components/legal/legal-layout";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Privacy Policy — KanjiKatch",
  description: "How KanjiKatch handles your personal information and study content.",
};

const LAST_UPDATED = "May 14, 2026";

export default async function PrivacyPage() {
  const { userId } = await auth();
  return (
    <>
      <LegalLayout title="Privacy Policy" lastUpdated={LAST_UPDATED} isSignedIn={Boolean(userId)}>
        <p>
          This Privacy Policy describes how KanjiKatch (&ldquo;KanjiKatch,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, shares, and
          protects information when you use our website and web app (the
          &ldquo;Service&rdquo;). It applies in addition to our{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>

        <h2>1. Information we collect</h2>
        <h3>Information you provide</h3>
        <ul>
          <li>
            <strong>Account info.</strong> Email address and authentication
            data (handled by Clerk on our behalf). If you sign in with a
            third-party identity provider (Google, GitHub, etc.), we receive
            basic profile information from that provider via Clerk.
          </li>
          <li>
            <strong>Study content.</strong> Images you upload, text you paste,
            kanji and vocabulary you save, sentences you generate, notes,
            ratings, and any edits.
          </li>
          <li>
            <strong>Billing info.</strong> If you subscribe to Pro, payment
            data (card details, billing address) is collected and stored by
            Stripe. We never see or store your card number. We receive a
            Stripe customer ID, subscription status, current period end, and
            similar metadata.
          </li>
          <li>
            <strong>Support.</strong> If you email us or fill out a feedback
            form, we keep the message and any context you include.
          </li>
        </ul>

        <h3>Information collected automatically</h3>
        <ul>
          <li>
            <strong>Usage events.</strong> Per-API-call records noting the
            endpoint, model, token counts, estimated cost, and a salted hash
            of your IP address. We use these to enforce per-user and per-IP
            cost-protection limits and to detect abuse.
          </li>
          <li>
            <strong>Error reports.</strong> When the Service errors, we send
            a redacted error report to Sentry. We strip request bodies and
            cookies; stack traces may still contain incidental personal data.
          </li>
          <li>
            <strong>Cookies and similar technologies.</strong> We use only
            essential cookies needed for authentication and session
            management. We do not use advertising or cross-site tracking
            cookies. If we add product analytics later, we&apos;ll update this
            policy and add an in-product disclosure first.
          </li>
        </ul>

        <h2>2. How we use information</h2>
        <ul>
          <li>To run the Service and personalize it to you;</li>
          <li>To process your subscription, billing, and refunds;</li>
          <li>
            To generate, recommend, and schedule review content (extractions,
            sentences, audio);
          </li>
          <li>
            To detect, prevent, and respond to abuse, fraud, and security
            incidents;
          </li>
          <li>
            To debug and improve the Service (operational analytics, error
            triage);
          </li>
          <li>
            To send transactional emails (welcome, billing receipts, trial
            reminders, session recaps for Pro users). We do not send
            marketing email without an explicit opt-in;
          </li>
          <li>To comply with legal obligations.</li>
        </ul>

        <h2>3. AI processing</h2>
        <p>
          KanjiKatch uses third-party AI providers — currently Anthropic — to
          extract text from your inputs and to generate example sentences.
          When you trigger an extraction or sentence generation, the relevant
          input (an image URL or text snippet, plus a list of target words for
          sentence generation) is sent to the provider for processing.
        </p>
        <p>
          We have a commercial agreement in place with Anthropic and rely on
          their commitment that customer inputs and outputs through the
          Anthropic API are not used to train Anthropic models. Outputs are
          stored on KanjiKatch infrastructure and returned to you in-app.
          We do not currently use AI providers for any purpose other than
          producing your study material.
        </p>

        <h2>4. Subprocessors</h2>
        <p>
          We use the following third-party services to operate KanjiKatch.
          Each is bound by its own privacy and security commitments.
        </p>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Purpose</th>
              <th>Data shared</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Clerk</td>
              <td>Authentication, identity management</td>
              <td>Email, login credentials, third-party identity tokens</td>
            </tr>
            <tr>
              <td>Neon</td>
              <td>Managed PostgreSQL database (US region)</td>
              <td>All your account and study data</td>
            </tr>
            <tr>
              <td>Anthropic</td>
              <td>AI extraction and sentence generation</td>
              <td>Uploaded images / pasted text; target word lists</td>
            </tr>
            <tr>
              <td>Uploadthing</td>
              <td>Image storage and delivery</td>
              <td>Images you upload, until they are deleted</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Subscription billing and payment processing</td>
              <td>Email, payment method, billing address, subscription metadata</td>
            </tr>
            <tr>
              <td>Sentry</td>
              <td>Error monitoring</td>
              <td>Redacted error reports and stack traces</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>Transactional email (when enabled)</td>
              <td>Email address, message content</td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Hosting and content delivery</td>
              <td>Request logs (IP, user-agent, path)</td>
            </tr>
          </tbody>
        </table>
        <p>
          We may add or replace subprocessors. If we add a subprocessor with
          materially different data-handling, we&apos;ll update this list and
          give notice to subscribed users before the change takes effect.
        </p>

        <h2>5. Image retention</h2>
        <p>
          Uploaded images are stored on Uploadthing on our behalf. Free-tier
          uploads are deleted from Uploadthing after extraction completes.
          Pro-tier uploads are retained so you can re-extract or revisit them;
          you can delete any retained image from your library. Image
          extraction sends image URLs (signed, short-lived) to Anthropic for
          OCR; we do not retain the image bytes in our database.
        </p>

        <h2>6. Cookies</h2>
        <p>
          We use only essential cookies needed for authentication and the
          session. We do not set advertising or third-party tracking cookies
          and do not currently load third-party analytics. Cookies set by
          Clerk are described in Clerk&apos;s privacy policy.
        </p>

        <h2>7. Sharing</h2>
        <p>
          We share information with subprocessors as described above and only
          to the extent needed to run the Service. We do not sell or rent
          your personal information. We may disclose information in response
          to a valid legal process, to enforce our Terms, or to protect
          rights, safety, or property — and we&apos;ll push back on overbroad
          requests where we can.
        </p>
        <p>
          If KanjiKatch is involved in a merger, acquisition, or asset sale,
          your information may be transferred. We will give notice before
          your data becomes subject to a different privacy policy.
        </p>

        <h2>8. Data retention</h2>
        <ul>
          <li>
            <strong>Active accounts:</strong> we keep your data as long as
            your account is active.
          </li>
          <li>
            <strong>Deleted accounts:</strong> when you delete your account,
            we delete your user record and all related study data
            (cards, vocabulary, sentences, sessions, generated sentences,
            review history, uploaded images, billing metadata) from our
            database. Anonymized usage events (without your user ID) and
            abuse-prevention logs may be retained for up to 90 days for
            security and operational purposes. Backup snapshots roll off on
            our backup retention schedule.
          </li>
          <li>
            <strong>Billing records:</strong> we retain billing records
            (transaction history, invoices) for as long as required by tax
            and accounting law, even after account deletion.
          </li>
          <li>
            <strong>Error reports:</strong> Sentry retains error events per
            its own retention policy (typically 30–90 days).
          </li>
        </ul>

        <h2>9. Your rights</h2>
        <p>
          Depending on where you live, you may have rights under GDPR, CCPA,
          or other privacy laws — including the right to access, correct,
          export, delete, restrict processing, or object to processing of your
          personal information.
        </p>
        <ul>
          <li>
            <strong>Access and export:</strong> use the &ldquo;Export my
            data&rdquo; button in your account settings to download a JSON
            archive of your data.
          </li>
          <li>
            <strong>Delete:</strong> use the &ldquo;Delete my account&rdquo;
            button in your account settings, or email us. Deletion is
            permanent.
          </li>
          <li>
            <strong>Other requests:</strong> email{" "}
            <a href="mailto:support@kanjikatch.com">
              support@kanjikatch.com
            </a>
            . We&apos;ll respond within the time required by applicable law.
          </li>
        </ul>

        <h2>10. International transfers</h2>
        <p>
          KanjiKatch is operated from the United States. If you use the
          Service from outside the US, your information will be transferred
          to and processed in the US. Where required, we rely on Standard
          Contractual Clauses or equivalent mechanisms to transfer data
          internationally.
        </p>

        <h2>11. Security</h2>
        <p>
          We use industry-standard technical and organizational measures to
          protect your information, including encryption in transit (TLS),
          encryption at rest for the database, salted hashing for IP
          addresses, scoped access controls, and audit logging. No system is
          perfectly secure; you use the Service at your own risk.
        </p>

        <h2>12. Children</h2>
        <p>
          KanjiKatch is not directed at children under 13 (or the higher
          minimum age in your country). We do not knowingly collect personal
          information from children. If you believe a child has provided us
          personal information, contact us and we will delete it.
        </p>

        <h2>13. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. If we make
          material changes, we&apos;ll notify you by email or in-product before
          they take effect.
        </p>

        <h2>14. Contact</h2>
        <p>
          Privacy questions, requests, and complaints can be sent to{" "}
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
