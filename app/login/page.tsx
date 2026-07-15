import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Anmelden",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Already signed in? Straight to the admin area.
  const store = await cookies();
  const session = await verifySession(store.get(COOKIE_NAME)?.value);
  if (session) redirect("/admin/events");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Anmelden
        </h1>
        <p className="mb-8 text-sm text-neutral-500">
          Nur für das Akademie-Team: Hier bearbeitest du Veranstaltungen und
          Seiten.
        </p>
        <LoginForm />
      </main>

      <SiteFooter />
    </div>
  );
}
