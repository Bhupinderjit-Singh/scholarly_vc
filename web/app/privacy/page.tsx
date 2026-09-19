import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import {
  LEGAL_PAGES,
  LEGAL_UPDATED,
  PRIVACY_CONTACT,
} from "@/components/legal/legal-content";
import { LegalPage } from "@/components/legal/legal-page";
import { LegalSection } from "@/components/legal/legal-section";

export const metadata: Metadata = {
  title: LEGAL_PAGES.privacy.title,
  description:
    "What Scholarly collects, which services it relies on, how the optional focus analysis records your own camera and deletes the recording, and how to delete your account.",
};

/**
 * Static privacy policy (F1-R12.1, F1-R12.2). Served without sign-in because
 * Google's OAuth consent screen requires a public privacy policy URL. The
 * retention promises here mirror docs/REQUIREMENTS.md (F6-R8, F6-R11, NFR-4);
 * change them together.
 */
export default function PrivacyPage(): ReactElement {
  return (
    <LegalPage
      page="privacy"
      title={LEGAL_PAGES.privacy.title}
      updated={LEGAL_UPDATED}
      intro={
        <>
          <p>
            Scholarly is a small &ldquo;study together&rdquo; app. You start or
            schedule a private video session, invite friends, and everyone
            studies with their cameras on. This page explains, in plain words,
            what we store about you and why. The short version:
          </p>
          <ul>
            <li>
              Only your own camera and microphone can ever be recorded, and only
              if you turn focus analysis on. Other participants are never
              recorded.
            </li>
            <li>
              A recording exists only to produce your private focus report and
              is deleted within 60 seconds after the report is stored.
            </li>
            <li>
              We do not sell your data, show ads, or use advertising or
              analytics trackers.
            </li>
            <li>
              You can delete a single report, any media, or your whole account
              yourself, at any time.
            </li>
          </ul>
        </>
      }
    >
      <LegalSection id="data-we-collect" title="Data we collect">
        <p>We keep only what the app needs to work:</p>
        <ul>
          <li>
            <strong>Account.</strong> Your email address, username, display
            name, and, when you sign in with Google, the profile picture Google
            provides. Passwords are stored only as scrypt hashes; we never see
            or log the plain text.
          </li>
          <li>
            <strong>Sessions.</strong> The sessions you host or join, who was
            invited and who accepted, when you joined and left, and the number
            of seconds your camera was on. Camera-on time is the only time that
            counts as study time; it feeds your dashboard, history, and streak.
          </li>
          <li>
            <strong>Settings.</strong> Your timezone, your daily study target
            (with its history, so past days compare against the target that
            applied then), your notification preferences, and, once focus
            analysis ships, its opt-in switches.
          </li>
          <li>
            <strong>Notifications.</strong> Your in-app notifications, which we
            prune after 90 days, and, if you turn on push notifications, the
            browser subscription needed to deliver them.
          </li>
          <li>
            <strong>Usage counters.</strong> Monthly video minutes and analysis
            hours, per user and in total, used only to stay within the free
            tiers we run on.
          </li>
          <li>
            <strong>Technical logs.</strong> Structured server logs with a
            request id, your user id, the route, and timings. Logs never contain
            email addresses, names, passwords, tokens, or cookies.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="focus-analysis"
        title="Focus analysis (Phase 2, opt-in)"
      >
        <p>
          Focus analysis is a planned, optional feature (Scholarly&rsquo;s
          second phase). Until it launches, nothing is ever recorded. Once it
          exists it is off by default: you turn it on in Settings &rsaquo; Focus
          analysis, confirm it again for each session on the pre-join screen,
          and see a persistent &ldquo;Analyzing &middot; REC&rdquo; indicator
          whenever it is running. When it is on, this is exactly what happens:
        </p>
        <ul>
          <li>
            <strong>What is captured.</strong> Your own camera at 320×240 pixels
            and 5 frames per second. Your microphone is captured only if you
            also turn on &ldquo;Also analyze audio&rdquo;, and then even while
            you are muted in the call. Never another participant&rsquo;s video
            or audio, and never your screen. Other participants are never
            recorded.
          </li>
          <li>
            <strong>Where it goes.</strong> Your browser records the video and
            uploads it in chunks to a private, encrypted storage bucket on
            Cloudflare R2. A worker on Modal downloads it, derives the report,
            and deletes its own temporary files.
          </li>
          <li>
            <strong>What is derived.</strong> Presence, attention (looking
            away), phone use, drowsiness, talking, and background noise,
            combined into a focus score, deep-work blocks, and a per-minute
            timeline. A report holds these numbers only, never frames or audio.
          </li>
          <li>
            <strong>How long the media lives.</strong> We delete the recording
            within 60 seconds after the report is stored, or after analysis
            fails. Two backstops cover anything that slips through: a scheduled
            sweep deletes every recording older than 48 hours, and the storage
            bucket&rsquo;s own lifecycle rule deletes objects after 2 days. A
            recording therefore lives at most 48 hours in any case.
          </li>
          <li>
            <strong>Who sees the report.</strong> Only you, unless you choose to
            share it with that session&rsquo;s participants; you can stop
            sharing at any moment. The weekly leaderboard is opt-in and lists
            only people who opted in themselves.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="third-party-services" title="Third-party services">
        <p>
          Scholarly relies on a few hosted providers. Each processes data on our
          behalf, under its own terms, and receives only what is listed here:
        </p>
        <dl>
          <div>
            <dt>Google (sign-in)</dt>
            <dd>
              When you choose &ldquo;Continue with Google&rdquo;, Google shares
              your name, email address, and profile picture with us. We request
              only the sign-in scopes (<code>openid</code>, <code>email</code>,{" "}
              <code>profile</code>) and never ask for access to your calendar,
              contacts, or files.
            </dd>
          </div>
          <div>
            <dt>LiveKit</dt>
            <dd>
              Carries the real-time video and audio of a session between its
              participants. It receives your user id as the participant identity
              and the session&rsquo;s room name. We never use LiveKit&rsquo;s
              recording features.
            </dd>
          </div>
          <div>
            <dt>Neon</dt>
            <dd>
              Hosts our Postgres database, which holds everything listed under
              &ldquo;Data we collect&rdquo;. It never holds video or audio.
            </dd>
          </div>
          <div>
            <dt>Vercel</dt>
            <dd>Hosts the application and stores its server logs.</dd>
          </div>
          <div>
            <dt>Resend</dt>
            <dd>
              Sends our transactional email to your address: verification,
              password reset, session reminders, and the notifications you have
              turned on.
            </dd>
          </div>
          <div>
            <dt>Cloudflare R2 (Phase 2)</dt>
            <dd>
              Private, temporary storage for your recording chunks until the
              analysis finishes and the media is deleted.
            </dd>
          </div>
          <div>
            <dt>Modal (Phase 2)</dt>
            <dd>
              Runs the analysis worker that turns a recording into a report and
              keeps no media once a run ends.
            </dd>
          </div>
          <div>
            <dt>Browser push services</dt>
            <dd>
              If you enable push notifications, your browser vendor&rsquo;s push
              service relays them. Push payloads never contain personal data.
            </dd>
          </div>
        </dl>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>
          We use cookies only for signing in: a session cookie that keeps you
          signed in (<code>HttpOnly</code>, <code>Secure</code>,{" "}
          <code>SameSite=Lax</code>; it expires 30 days after your last visit)
          and short-lived cookies that protect the sign-in flow itself. There
          are no advertising or analytics cookies.
        </p>
      </LegalSection>

      <LegalSection id="retention-and-deletion" title="Retention and deletion">
        <p>
          Account data stays for as long as your account exists. Recordings
          follow the timelines in the{" "}
          <a href="#focus-analysis">focus-analysis section</a>, reports stay
          until you delete them, in-app notifications are pruned after 90 days,
          and sign-in sessions expire 30 days after their last use (or at once
          when you choose &ldquo;Sign out everywhere&rdquo;). You can also
          delete things yourself:
        </p>
        <ul>
          <li>
            <strong>A focus report.</strong> Open the report and choose
            &ldquo;Delete report&rdquo;. The report and the dashboard numbers
            derived from it are removed within 60 seconds.
          </li>
          <li>
            <strong>Your whole account.</strong> Go to Settings &rsaquo;
            Account, choose &ldquo;Delete account&rdquo;, and type your username
            to confirm. Within 60 seconds we delete your profile, settings,
            sign-in sessions, invites, participations, camera-on records and
            daily totals, notifications, push subscriptions, calendar tokens,
            recording metadata, media, and reports. Scheduled sessions you host
            are cancelled and their invitees are told; a live session you host
            is ended. Those session records stay, with your name removed, so the
            other participants keep their history. You are then signed out.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="your-choices" title="Your choices">
        <ul>
          <li>
            Turn your camera off at any time. Camera-off time is simply not
            counted as study time.
          </li>
          <li>
            Leave focus analysis off (the default), turn it on per session, and
            decide separately whether audio is analyzed.
          </li>
          <li>
            Share or unshare each focus report, and join or leave the weekly
            leaderboard.
          </li>
          <li>
            Choose, per notification type, whether you get it in the app, by
            email, or as a push notification.
          </li>
          <li>Change or reset your password, and sign out everywhere.</li>
        </ul>
      </LegalSection>

      <LegalSection id="security" title="How we protect data">
        <p>
          Everything travels over HTTPS. Passwords are hashed with scrypt.
          Sign-in, password-reset, and verification endpoints are rate limited.
          Video-room tokens are valid for one hour and scoped to a single
          session; upload links for recordings are valid for 15 minutes and
          bound to a single file part. Every message from the video and analysis
          providers to our server is signature-checked before it is trusted.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Questions">
        <p>
          For questions or requests about your data, contact {PRIVACY_CONTACT}.
          Using Scholarly is also subject to the{" "}
          <Link href={LEGAL_PAGES.terms.href}>{LEGAL_PAGES.terms.title}</Link>.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          We will update this page when Scholarly changes, for example when
          focus analysis launches. The &ldquo;Last updated&rdquo; date at the
          top tells you when it last changed. If a change affects what we
          collect or how long we keep it, we will let signed-in users know in
          the app before it takes effect.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
