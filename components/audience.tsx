import {
  GraduationCap,
  MessageCircleQuestion,
  Rocket,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

type Item = { icon: LucideIcon; title: string; description: string };

// "Für wen ist das?" — deliberately simple language for non-technical
// professionals. Grid style mirrors the Kubikraum Digital features grid.
const ITEMS: Item[] = [
  {
    icon: UserCheck,
    title: "Für Fachleute",
    description:
      "Du kennst dein Fachgebiet. Wir zeigen dir, wie KI dich dabei unterstützt.",
  },
  {
    icon: GraduationCap,
    title: "Keine Vorkenntnisse nötig",
    description:
      "Du musst nicht programmieren können. Ein Laptop und ein Browser reichen.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Einfache Sprache",
    description:
      "Wir erklären alles Schritt für Schritt — ohne Fachbegriffe.",
  },
  {
    icon: Rocket,
    title: "Sofort anwendbar",
    description:
      "Du übst an echten Beispielen aus deinem Arbeitsalltag.",
  },
];

export function Audience() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold tracking-tight">
        Für wen ist das?
      </h2>
      <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
        {ITEMS.map(({ icon: Icon, title, description }) => (
          <div key={title} className="group flex gap-3">
            <Icon
              className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition duration-300 group-hover:text-info motion-safe:group-hover:rotate-[12deg] motion-reduce:transition-none dark:text-neutral-500"
              aria-hidden
            />
            <div>
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
