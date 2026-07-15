import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AGB",
  description:
    "Allgemeine Geschäftsbedingungen der Kubikraum Akademie.",
  alternates: { canonical: "/agb" },
};

export default function AgbPage() {
  return <LegalPage slug="agb" />;
}
