import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "./actions";

// Shell for the admin area (gated by proxy.ts). A slim header with the two
// content sections, a link back to the public site, and logout.
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-neutral-200/70 bg-white/75 px-6 py-4 backdrop-blur-md dark:border-neutral-800/70 dark:bg-neutral-950/75">
        <div className="flex items-center gap-6">
          <Link href="/admin/events" className="flex items-center gap-2">
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
              Akademie{" "}
              <span className="font-normal text-neutral-500">Admin</span>
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/admin/events"
              className="text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Veranstaltungen
            </Link>
            <Link
              href="/admin/pages"
              className="text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Seiten
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/"
            className="text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Zur Website
          </Link>
          <ThemeToggle />
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Abmelden
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
