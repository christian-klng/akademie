import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: "Datenschutzerklärung der Kubikraum Akademie.",
  alternates: { canonical: "/datenschutz" },
};

export default function DatenschutzPage() {
  return <LegalPage slug="datenschutz" />;
}
