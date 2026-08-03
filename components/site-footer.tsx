import Link from "next/link";
import { EuFlag, DeFlag } from "@/components/flags";

// Subtle site footer shared by all public pages. Mirrors the Kubikraum
// Digital footer (trust badges + legal links).
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 px-6 py-8 dark:border-neutral-800">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 text-xs text-neutral-500 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: trust badges, stacked */}
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10 dark:ring-white/20">
              <EuFlag className="h-full w-full" />
            </span>
            DSGVO-konform und in der EU gehostet
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-4 w-[27px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10 dark:ring-white/20">
              <DeFlag className="h-full w-full" />
            </span>
            Entwickelt in Deutschland
          </span>
        </div>

        {/* Right: slogan + legal menu */}
        <div className="flex flex-col gap-3 sm:items-end sm:text-right">
          <p>
            © {year} Kubikraum Akademie · Weiterbildung zu KI und Software.
          </p>
          <nav className="flex items-center gap-5">
            <Link
              href="/events"
              className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Termine
            </Link>
            <Link
              href="/agb"
              className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              AGB
            </Link>
            <Link
              href="/datenschutz"
              className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Datenschutz
            </Link>
            <Link
              href="/impressum"
              className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Impressum
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
