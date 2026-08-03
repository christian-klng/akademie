import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getPublishedEvent } from "@/lib/queries";
import { formatEventDate, formatEventTime } from "@/lib/format";

export const dynamic = "force-dynamic";

// Not a page anyone should land on from a search result.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Shown after signing up. Three ways in:
 *   ?status=frei        — free event, seat confirmed
 *   ?status=warteliste  — event was full
 *   no parameter        — Stripe sent the visitor back after paying
 */
export default async function DankePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status } = await searchParams;
  const event = await getPublishedEvent(slug);
  if (!event) notFound();

  const heading =
    status === "warteliste"
      ? "Du stehst auf der Warteliste"
      : "Danke für deine Anmeldung!";

  const text =
    status === "warteliste"
      ? "Alle Plätze sind gerade vergeben. Wir melden uns bei dir, sobald einer frei wird — du musst nichts weiter tun."
      : status === "frei"
        ? "Dein Platz ist reserviert. Die Bestätigung ist gerade per E-Mail zu dir unterwegs."
        : "Wir haben deine Anmeldung. Sobald deine Zahlung bei uns angekommen ist, bekommst du die Bestätigung per E-Mail.";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-3 text-lg text-neutral-500">{text}</p>

        <div className="mt-8 rounded-xl border border-neutral-300 bg-white p-5 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <p className="font-medium">{event.title}</p>
          <p className="mt-1 text-neutral-500">
            {formatEventDate(event.startsAt)} ·{" "}
            {formatEventTime(event.startsAt, event.endsAt)}
          </p>
        </div>

        <p className="mt-6 text-sm text-neutral-500">
          Keine E-Mail bekommen? Schau bitte kurz im Spam-Ordner nach.
        </p>

        <div className="mt-8 flex gap-4 text-sm">
          <Link href={`/events/${event.slug}`} className="underline">
            Zurück zur Veranstaltung
          </Link>
          <Link href="/events" className="underline">
            Alle Veranstaltungen
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
