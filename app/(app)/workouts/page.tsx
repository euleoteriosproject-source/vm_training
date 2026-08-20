import Link from "next/link";
import { ChevronRight, Clock3, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StartButton } from "@/components/workout/start-button";
import { createClient } from "@/lib/supabase/server";
export default async function WorkoutsPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("workout_plans")
    .select(
      "id,name,status,created_at,target_session_minutes,workout_days(id,name,position,estimated_minutes,workout_day_exercises(count))",
    )
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: false });
  const plan =
    plans?.find((item) => item.status === "active") ??
    plans?.find((item) => item.status === "draft") ??
    null;
  const isDraft = plan?.status === "draft";
  const days = (plan?.workout_days ?? []).sort(
    (a, b) => a.position - b.position,
  );
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-accent">Plano atual</p>
          <h1 className="mt-1 text-3xl font-semibold">
            {plan?.name ?? "Treinos"}
          </h1>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/profile#preferences">
            <RefreshCw size={17} />
            Recalcular
          </Link>
        </Button>
      </div>
      {isDraft && (
        <Card className="mt-6 border-warning/40 bg-warning/10 p-4 text-sm">
          Este é o seu rascunho personalizado. A execução permanece bloqueada
          até todos os vídeos necessários passarem pela revisão técnica.
        </Card>
      )}
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {days.map((day) => (
          <Card key={day.id} className="p-5">
            <Link
              href={`/workouts/${day.id}`}
              className="group flex items-start justify-between"
            >
              <div>
                <p className="text-xl font-semibold">{day.name}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <Clock3 size={15} />
                  {day.estimated_minutes} min ·{" "}
                  {day.workout_day_exercises?.[0]?.count ?? 0} exercícios
                </p>
              </div>
              <ChevronRight className="text-muted group-hover:text-accent" />
            </Link>
            {isDraft ? (
              <p className="mt-6 rounded-xl bg-surface-alt p-3 text-center text-sm text-muted">
                Aguardando liberação das demonstrações
              </p>
            ) : (
              <StartButton dayId={day.id} className="mt-6 w-full" />
            )}
          </Card>
        ))}
        {days.length === 0 && (
          <Card className="col-span-full p-8 text-center">
            <h2 className="text-xl font-semibold">Nenhum plano ativo</h2>
            <p className="mt-2 text-muted">
              O gerador usa somente exercícios com mídia aprovada e equipamentos
              disponíveis.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
