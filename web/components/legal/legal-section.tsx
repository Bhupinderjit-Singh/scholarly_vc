import type { ReactElement, ReactNode } from "react";

interface LegalSectionProps {
  /** Stable anchor, kebab-case (`data-we-collect`); also names the heading. */
  id: string;
  title: string;
  children: ReactNode;
}

/**
 * One titled section of a legal page: an `h2` plus its paragraphs and lists.
 * `aria-labelledby` turns the `section` into a named landmark so screen
 * readers can jump between sections, and the `id` makes `#anchor` links work
 * (the consent copy in spec 06 links straight to the focus-analysis section).
 */
export function LegalSection({
  id,
  title,
  children,
}: LegalSectionProps): ReactElement {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-24 space-y-3"
    >
      <h2 id={headingId} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
