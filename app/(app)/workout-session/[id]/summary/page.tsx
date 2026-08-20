import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("workout_sessions")
    .select(
      "duration_seconds,completed_at,workout_session_exercises(id,status,set_logs(completed),cardio_logs(duration_seconds))",
    )
    .eq("id", id)
    .eq("status", "completed")
    .maybeSingle();
  if (!session) notFound();
  const exercises = session.workout_session_exercises ?? [];
  const sets = exercises
    .flatMap((e) => e.set_logs ?? [])
    .filter((s) => s.completed).length;
  const cardio = Math.round(
    exercises
      .flatMap((e) => e.cardio_logs ?? [])
      .reduce((sum, log) => sum + log.duration_seconds, 0) / 60,
  );
  return (
    <div className="mx-auto grid min-h-[75dvh] max-w-2xl place-items-center">
      <div className="w-full text-center">
        <CheckCircle2 size={52} className="mx-auto text-success" />
        <h1 className="mt-5 text-4xl font-semibold">Treino concluído</h1>
        <Card className="mt-8 grid grid-cols-2 gap-5 p-6 sm:grid-cols-4">
          <Stat
            value={`${Math.round((session.duration_seconds ?? 0) / 60)} min`}
            label="duração"
          />
          <Stat value={String(exercises.length)} label="exercícios" />
          <Stat value={String(sets)} label="séries" />
          <Stat value={`${cardio} min`} label="cardio" />
        </Card>
        <div className="mt-7 flex justify-center gap-3">
          <Button asChild>
            <Link href="/today">Concluir</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/progress#history">Ver histórico</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
