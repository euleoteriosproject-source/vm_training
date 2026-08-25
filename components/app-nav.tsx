"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Dumbbell,
  Film,
  ShieldCheck,
  Settings,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const main = [
  { href: "/today", label: "Hoje", icon: CalendarDays },
  { href: "/workouts", label: "Treinos", icon: Dumbbell },
  { href: "/progress", label: "Progresso", icon: ChartNoAxesCombined },
  { href: "/profile", label: "Perfil", icon: UserRound },
];
export function AppNav({
  admin = false,
  adminMaintenance = false,
}: {
  admin?: boolean;
  adminMaintenance?: boolean;
}) {
  const path = usePathname();
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-surface p-6 md:flex md:flex-col">
        <Link href="/today" className="text-xl font-bold">
          <span className="text-accent">VM</span> Training
        </Link>
        <nav className="mt-10 space-y-2">
          {main.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-alt hover:text-foreground",
                path.startsWith(href) && "bg-surface-alt text-foreground",
              )}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <Link
            href="/settings"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-alt"
          >
            <Settings size={19} />
            Configurações
          </Link>
          {admin && (
            <>
              <Link
                href="/admin/exercises"
                className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-alt"
              >
                <Dumbbell size={19} />
                Exercícios
              </Link>
              {adminMaintenance && (
                <>
                  <Link
                    href="/admin/media-review"
                    className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-alt"
                  >
                    <Film size={19} />
                    Revisar mídia
                  </Link>
                  <Link
                    href="/admin/release-readiness"
                    className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-alt"
                  >
                    <ShieldCheck size={19} />
                    Release
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </aside>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(68px+env(safe-area-inset-bottom))] grid-cols-4 border-t bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {main.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted",
              path.startsWith(href) && "text-accent",
            )}
          >
            <Icon size={21} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
