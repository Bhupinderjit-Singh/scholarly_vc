import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import {
  GOVERNING_LAW,
  LEGAL_PAGES,
  LEGAL_UPDATED,
  PRIVACY_CONTACT,
} from "@/components/legal/legal-content";
import { LegalPage } from "@/components/legal/legal-page";
import { LegalSection } from "@/components/legal/legal-section";

export const metadata: Metadata = {
  title: LEGAL_PAGES.terms.title,
  description:
    "The plain-words rules for using Scholarly: who may use it, how to treat other participants, what the free-tier limits mean, and what we do and do not promise.",
};

/**
 * Static terms of use (F1-R12.1, F1-R12.3). Served without sign-in and kept
 * short: Scholarly is a personal, non-commercial project for a small circle of
 * friends, so these terms say what that means in practice.
 */
export default function TermsPage(): ReactElement {
  return (
    <LegalPage
      page="terms"
      title={LEGAL_PAGES.terms.title}
      updated={LEGAL_UPDATED}
      intro={
        <p>
          Scholarly is a personal, non-commercial project run by its owner so
          that a small circle of friends can study together over video. These
          terms are short on purpose. By creating an account or using Scholarly
          you agree to them and to the{" "}
          <Link href={LEGAL_PAGES.privacy.href}>
            {LEGAL_PAGES.privacy.title}
          </Link>
          , which explains what we store and for how long.
        </p>
      }
    >
      <LegalSection id="who-may-use" title="Who may use Scholarly">
        <p>
          Scholarly is for personal, non-commercial use by people the owner has
          invited or chosen to admit. Sign-up may be open or closed at any time;
          when it is closed, existing accounts keep working. You may not use
          Scholarly to run a business, a class you charge for, or any other
          commercial service.
        </p>
      </LegalSection>

      <LegalSection id="your-account" title="Your account">
        <ul>
          <li>
            Give accurate details, keep them current, and use a display name
            your friends will recognize.
          </li>
          <li>
            Keep your password to yourself. Choose one that is at least 10
            characters long and not on common-password lists; the sign-up form
            enforces this.
          </li>
          <li>
            One account per person. Do not create accounts for other people or
            let someone else use yours.
          </li>
          <li>
            You are responsible for what happens under your account. If you
            think someone else has access, change your password, use &ldquo;Sign
            out everywhere&rdquo;, and tell the owner.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Acceptable use">
        <p>Scholarly only works if everyone in a session feels safe. So:</p>
        <ul>
          <li>
            Do not record, screenshot, or otherwise capture other participants.
            The app never records anyone but you, and only with your own opt-in;
            doing it by other means breaks the trust the app is built on.
          </li>
          <li>
            No harassment, threats, hate, or sexual content, and nothing
            unlawful. Treat a study session like a shared library table.
          </li>
          <li>
            Do not share invite links with people the host did not intend to
            admit, and do not try to join sessions you were not invited to.
          </li>
          <li>
            Do not abuse the free-tier limits Scholarly runs on: no idle
            sessions left running to burn video minutes, no automated sign-ups
            or scripted requests, and no attempts to get around the monthly
            caps.
          </li>
          <li>
            Do not probe, overload, or try to break the service, or access data
            that is not yours.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="sessions-and-content" title="Sessions and content">
        <p>
          The host of a session controls its invites and invite link, may edit
          or cancel it, remove participants, and end it. Only the host and
          accepted invitees can join. We may end a session, pause a feature, or
          lower a limit when that is needed to stay within the caps that keep
          Scholarly free. Study-time numbers, streaks, and focus reports are
          there to motivate you; they are automated estimates, not certified
          records, and they can be wrong. Do not rely on a focus report, and in
          particular on its drowsiness signal, for any medical or safety
          decision.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="Service availability">
        <p>
          Scholarly runs on free hosting tiers with monthly limits on video
          minutes, emails, storage, and analysis time. We make no promise about
          uptime. When a limit is reached, the affected feature pauses until the
          next month or until the owner changes the setup. We may change,
          suspend, or remove features, or perform maintenance, without notice.
        </p>
      </LegalSection>

      <LegalSection id="ending" title="Ending your use">
        <p>
          You can delete your account at any time from Settings &rsaquo;
          Account; the{" "}
          <Link href={`${LEGAL_PAGES.privacy.href}#retention-and-deletion`}>
            Privacy Policy
          </Link>{" "}
          describes exactly what is removed and how quickly. The owner may close
          registration, suspend or disable an account that breaks these terms or
          threatens the free-tier caps, and may shut Scholarly down entirely. If
          Scholarly shuts down, the data is deleted, not passed on.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" title="No warranties, limited liability">
        <p>
          Scholarly is provided &ldquo;as is&rdquo;, free of charge, by one
          person in their spare time. We do not promise that it will be
          available, error-free, or suited to any particular purpose. To the
          extent the law allows, the owner is not liable for lost data, lost
          study time, missed reminders, or any indirect or consequential loss
          arising from your use of Scholarly. Nothing here limits any liability
          that the law does not allow to be limited.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title="Governing law">
        <p>
          These terms are governed by {GOVERNING_LAW}, and any dispute about
          them is handled by the courts there.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to these terms">
        <p>
          We may update these terms as Scholarly changes. The &ldquo;Last
          updated&rdquo; date at the top tells you when. If you keep using
          Scholarly after a change, you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>Questions about these terms go to {PRIVACY_CONTACT}.</p>
      </LegalSection>
    </LegalPage>
  );
}
