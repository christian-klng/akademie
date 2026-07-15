import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Impressum",
  description:
    "Impressum der Kubikraum Akademie — Anbieterkennzeichnung nach § 5 DDG.",
  alternates: { canonical: "/impressum" },
};

export default function ImpressumPage() {
  return <LegalPage slug="impressum" />;
}
