// F1-R12: the static legal pages. Both are synchronous server components with
// no data access, so they render directly under jsdom. The assertions track
// the acceptance criteria: 12.1 (public, plain pages), 12.2 (privacy content:
// data collected, every third-party service, Phase 2 recording and deletion
// timelines, how to delete an account), and the cross-links that let a
// visitor reach one page from the other.
import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage, { metadata as privacyMetadata } from "@/app/privacy/page";
import TermsPage, { metadata as termsMetadata } from "@/app/terms/page";
import { LEGAL_PAGES, LEGAL_UPDATED } from "@/components/legal/legal-content";

/** `href`s of every link whose accessible name matches. */
function linkHrefs(name: string | RegExp): string[] {
  return screen
    .getAllByRole("link", { name })
    .map((link) => link.getAttribute("href") ?? "");
}

describe("F1-R12.2 privacy page", () => {
  it("renders the heading, the last-updated date, and metadata", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(screen.getByText(LEGAL_UPDATED.label)).toHaveAttribute(
      "datetime",
      LEGAL_UPDATED.iso,
    );
    expect(privacyMetadata.title).toBe("Privacy Policy");
    expect(privacyMetadata.description).toEqual(expect.any(String));
  });

  it("names every third-party service the app relies on", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";

    for (const service of [
      "Google",
      "LiveKit",
      "Neon",
      "Vercel",
      "Resend",
      "Cloudflare R2",
      "Modal",
    ]) {
      expect(text).toContain(service);
    }
  });

  it("states the recording promises and deletion timelines", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";

    expect(text).toContain("never recorded");
    expect(text).toContain("60 seconds");
    expect(text).toContain("48 hours");
    expect(text).toContain("2 days");
    expect(text).toContain("delete");
    expect(text).toContain("320×240");
  });

  it("covers the data collected, the recording behavior, and account deletion", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Data we collect" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /focus analysis/i }),
    ).toBeInTheDocument();

    const deletion = screen.getByRole("region", {
      name: "Retention and deletion",
    });
    expect(within(deletion).getByText(/Delete account/)).toBeInTheDocument();
    expect(deletion).toHaveTextContent(/type your username/);
  });

  it("links to the terms page, sign-in, and home", () => {
    render(<PrivacyPage />);

    expect(linkHrefs("Terms of Use")).toContain(LEGAL_PAGES.terms.href);
    expect(linkHrefs("Sign in")).toEqual(["/sign-in"]);
    expect(linkHrefs("Scholarly")).toEqual(["/"]);
  });
});

describe("F1-R12.1 terms page", () => {
  it("renders the heading and metadata", () => {
    render(<TermsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Use" }),
    ).toBeInTheDocument();
    expect(termsMetadata.title).toBe("Terms of Use");
    expect(termsMetadata.description).toEqual(expect.any(String));
  });

  it("has an acceptable-use section that forbids recording others", () => {
    render(<TermsPage />);

    const section = screen.getByRole("region", { name: "Acceptable use" });
    expect(
      within(section).getByRole("heading", {
        level: 2,
        name: "Acceptable use",
      }),
    ).toBeInTheDocument();
    expect(section).toHaveTextContent(/Do not record/);
  });

  it("links back to the privacy page", () => {
    render(<TermsPage />);

    const hrefs = linkHrefs("Privacy Policy");
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith(LEGAL_PAGES.privacy.href)).toBe(true);
    }
  });
});

describe("legal pages are static server components", () => {
  it("never opt into the client bundle", () => {
    // Both pages must render for the OAuth consent-screen crawler and for
    // visitors without JavaScript, so no file they are built from may carry
    // the "use client" directive.
    const sources = [
      "../../app/privacy/page.tsx",
      "../../app/terms/page.tsx",
      "../../components/legal/legal-page.tsx",
      "../../components/legal/legal-section.tsx",
    ];
    for (const source of sources) {
      const code = readFileSync(new URL(source, import.meta.url), "utf8");
      expect(code, source).not.toMatch(/^\s*["']use client["']/m);
    }
  });
});
