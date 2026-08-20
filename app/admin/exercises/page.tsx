import Link from "next/link";
import { Film, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
export default async function AdminExercisesPage() {
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select(
      "id,name_pt,category,movement_pattern,active,exercise_media(status,media_type,media_role,execution_quality,is_primary),exercise_equipment(equipment(name))",
    )
    .order("name_pt");
  const missing = (exercises ?? []).filter(
    (ex) =>
      !ex.exercise_media?.some(
        (m) =>
          m.status === "approved" &&
          m.media_role === "PRIMARY_DEMO" &&
          m.execution_quality === "approved" &&
          m.is_primary &&
          ["video", "gif"].includes(m.media_type),
      ),
  ).length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-accent">Administração</p>
          <h1 className="mt-1 text-3xl font-semibold">Exercícios</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/admin/catalog">
              <SlidersHorizontal size={17} />
              Catálogo global
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/exercises/new">
              <Plus size={17} />
              Novo
            </Link>
          </Button>
        </div>
      </div>
      <Card className="mt-7 flex items-center justify-between border-warning/30 p-5">
        <div>
          <p className="font-semibold">
            Exercícios sem mídia aprovada: {missing}
          </p>
          <p className="mt-1 text-sm text-muted">
            Eles não podem entrar em planos automáticos.
          </p>
        </div>
        <Film className="text-warning" />
      </Card>
      <div className="mt-5 overflow-hidden rounded-2xl border bg-surface">
        <div className="hidden grid-cols-[1fr_140px_150px_90px] gap-4 border-b px-5 py-3 text-xs uppercase tracking-wide text-muted md:grid">
          <span>Nome</span>
          <span>Movimento</span>
          <span>Equipamento</span>
          <span>Status</span>
        </div>
        {(exercises ?? []).map((ex) => {
          const eq =
            (
              ex.exercise_equipment?.[0]?.equipment as unknown as {
                name: string;
              } | null
            )?.name ?? "—";
          const media = ex.exercise_media?.some(
            (m) =>
              m.status === "approved" &&
              m.media_role === "PRIMARY_DEMO" &&
              m.execution_quality === "approved" &&
              m.is_primary &&
              ["video", "gif"].includes(m.media_type),
          );
          return (
            <Link
              href={`/admin/exercises/${ex.id}`}
              key={ex.id}
              className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 border-b px-5 py-3 last:border-0 hover:bg-surface-alt md:grid-cols-[1fr_140px_150px_90px]"
            >
              <span className="font-medium">{ex.name_pt}</span>
              <span className="hidden text-sm text-muted md:block">
                {ex.movement_pattern}
              </span>
              <span className="hidden text-sm text-muted md:block">{eq}</span>
              <span
                className={`rounded-full px-2 py-1 text-center text-xs ${ex.active && media ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
              >
                {ex.active && media ? "Ativo" : media ? "Inativo" : "Sem vídeo"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
