import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

// Sticky, blurred site header shared by the home page, event pages and the
// legal pages. Mirrors the Kubikraum Digital header.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-neutral-200/70 bg-white/75 px-6 py-4 backdrop-blur-md dark:border-neutral-800/70 dark:bg-neutral-950/75">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/brand/logo-on-light.svg"
          alt="Kubikraum Akademie"
          width={28}
          height={28}
          className="dark:hidden"
          priority
        />
        <Image
          src="/brand/logo-on-dark.svg"
          alt="Kubikraum Akademie"
          width={28}
          height={28}
          className="hidden dark:block"
          priority
        />
        <span className="font-semibold">
          Kubikraum{" "}
          <span className="font-normal text-neutral-500">Akademie</span>
        </span>
      </Link>
      <div className="flex items-center gap-3 text-sm">
        <Link href="/quizzes" className="font-medium hover:underline">
          Quizzes
        </Link>
        <ThemeToggle />
        <Link
          href="/login"
          className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Anmelden
        </Link>
      </div>
    </header>
  );
}
