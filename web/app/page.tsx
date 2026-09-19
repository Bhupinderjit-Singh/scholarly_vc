import { Button } from "@/components/ui/button";

// Placeholder until the app shell and Home page land (spec 01, task 2.2).
// It exercises the theme once: a lavender surface, ink text, and a Button.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <section className="w-full max-w-md rounded-xl bg-lavender p-8 shadow-soft">
        <h1 className="text-3xl font-semibold tracking-tight">Scholarly</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Study together. Coming soon.
        </p>
        <Button className="mt-6" type="button">
          Start a session
        </Button>
      </section>
    </main>
  );
}
