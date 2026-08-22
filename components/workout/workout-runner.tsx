"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Circle,
  MoreHorizontal,
  SkipForward,
  SwitchCamera,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ViewportVideo } from "@/components/video/viewport-video";
import {
  ExerciseDetails,
  type ExerciseDetail,
} from "@/components/exercise/exercise-details";
import { RestTimer } from "@/components/workout/rest-timer";
import { createClient } from "@/lib/supabase/client";
import {
  enqueueMutation,
  pendingMutations,
  removeMutation,
} from "@/lib/offline/queue";

type SetRow = {
  id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  completed: boolean;
};
type RunnerExercise = {
  id: string;
  actualExerciseId: string;
  plannedExerciseId: string | null;
  position: number;
  status: string;
  targetSets: number;
  repMin: number | null;
  repMax: number | null;
  restSeconds: number;
  category: string;
  requiredEquipmentIds: string[];
  detail: ExerciseDetail;
  sets: SetRow[];
};
export function WorkoutRunner({
  sessionId,
  sessionName,
  startedAt,
  exercises,
}: {
  sessionId: string;
  sessionName: string;
  startedAt: string;
  exercises: RunnerExercise[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(exercises);
  const [restEnds, setRestEnds] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = Number(localStorage.getItem(`rest:${sessionId}`));
    return saved > Date.now() ? saved : null;
  });
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const completed = items.reduce(
    (sum, item) => sum + item.sets.filter((set) => set.completed).length,
    0,
  );
  const total = items.reduce((sum, item) => sum + item.sets.length, 0);
  const progress = total ? Math.round((completed / total) * 100) : 0;
  useEffect(() => {
    const id = setInterval(
      () =>
        setElapsed(
          Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000),
        ),
      30000,
    );
    return () => clearInterval(id);
  }, [startedAt]);
  useEffect(() => {
    if (restEnds) localStorage.setItem(`rest:${sessionId}`, String(restEnds));
    else localStorage.removeItem(`rest:${sessionId}`);
  }, [restEnds, sessionId]);
  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    const supabase = createClient();
    for (const mutation of await pendingMutations()) {
      const { error } = await supabase
        .from(mutation.table)
        .update(mutation.payload)
        .eq(mutation.match.column, mutation.match.value);
      if (!error) await removeMutation(mutation.key);
    }
    setPendingCount((await pendingMutations()).length);
    setSyncing(false);
  }, []);
  useEffect(() => {
    const initialize = window.setTimeout(() => {
      void pendingMutations().then((items) => setPendingCount(items.length));
      void syncQueue();
    }, 0);
    window.addEventListener("online", syncQueue);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("online", syncQueue);
    };
  }, [syncQueue]);
  async function saveSet(
    exerciseId: string,
    setId: string,
    patch: Partial<SetRow>,
    restSeconds: number,
  ) {
    const previous = items
      .find((item) => item.id === exerciseId)
      ?.sets.find((set) => set.id === setId);
    setItems((current) =>
      current.map((item) =>
        item.id !== exerciseId
          ? item
          : {
              ...item,
              sets: item.sets.map((set) => {
                if (set.id !== setId) return set;
                return { ...set, ...patch };
              }),
            },
      ),
    );
    const payload = {
      ...patch,
      completed_at: patch.completed
        ? new Date().toISOString()
        : patch.completed === false
          ? null
          : undefined,
    };
    const result = navigator.onLine
      ? await createClient().from("set_logs").update(payload).eq("id", setId)
      : { error: new Error("offline") };
    const networkFailure =
      !navigator.onLine ||
      result.error?.message.toLowerCase().includes("failed to fetch");
    if (networkFailure) {
      await enqueueMutation({
        key: `set:${setId}`,
        table: "set_logs",
        match: { column: "id", value: setId },
        payload,
      });
      setPendingCount((await pendingMutations()).length);
      toast.info("Salvo offline");
    } else if (result.error) {
      toast.error("Não foi possível salvar esta série");
      if (previous)
        setItems((current) =>
          current.map((item) =>
            item.id !== exerciseId
              ? item
              : {
                  ...item,
                  sets: item.sets.map((set) =>
                    set.id === setId ? previous! : set,
                  ),
                },
          ),
        );
    } else
      toast.success(patch.completed ? "Série salva" : "Atualizado", {
        duration: 1200,
      });
    if (patch.completed && restSeconds > 0)
      setRestEnds(new Date().getTime() + restSeconds * 1000);
    const current = items.find((item) => item.id === exerciseId);
    if (
      current &&
      current.sets.every((set) =>
        set.id === setId ? Boolean(patch.completed) : set.completed,
      )
    )
      void createClient()
        .from("workout_session_exercises")
        .update({ status: "completed" })
        .eq("id", exerciseId);
  }
  async function skip(id: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "skipped" } : item,
      ),
    );
    const { error } = await createClient()
      .from("workout_session_exercises")
      .update({ status: "skipped" })
      .eq("id", id);
    if (error) toast.error("Não foi possível pular");
    else toast.success("Exercício pulado");
  }
  async function finish() {
    setFinishing(true);
    await syncQueue();
    const { error } = await createClient().rpc("finish_workout", {
      p_session_id: sessionId,
      p_notes: null,
    });
    if (error) {
      toast.error(error.message);
      setFinishing(false);
      return;
    }
    toast.success("Treino concluído");
    router.replace(`/workout-session/${sessionId}/summary`);
    router.refresh();
  }
  return (
    <>
      <header className="sticky top-0 z-30 -mx-4 -mt-7 border-b bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-b-2xl">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <div>
            <h1 className="font-semibold">{sessionName}</h1>
            <p className="text-xs text-muted">
              {elapsed} min ·{" "}
              {syncing
                ? "Sincronizando…"
                : pendingCount
                  ? `${pendingCount} alterações pendentes`
                  : "✓ Sincronizado"}
            </p>
          </div>
          <div className="ml-auto w-24">
            <div className="mb-1 text-right text-xs text-muted">
              {progress}%
            </div>
            <div className="h-1.5 rounded-full bg-surface-alt">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <Button variant="danger" onClick={finish} disabled={finishing}>
            Encerrar
          </Button>
        </div>
      </header>
      <div className="mx-auto mt-6 max-w-4xl space-y-5">
        {items.map((item) => (
          <ExerciseCard
            key={item.id}
            item={item}
            onSet={(setId, patch) =>
              saveSet(item.id, setId, patch, item.restSeconds)
            }
            onSkip={() => skip(item.id)}
            onSubstituted={(replacement) =>
              setItems((current) =>
                current.map((exercise) =>
                  exercise.id === item.id
                    ? {
                        ...exercise,
                        actualExerciseId: replacement.exerciseId,
                        detail: {
                          ...exercise.detail,
                          name: replacement.exerciseName,
                          mediaUrl: null,
                          posterUrl: null,
                          mediaType: null,
                          mediaSource: null,
                        },
                      }
                    : exercise,
                ),
              )
            }
          />
        ))}
      </div>
      <RestTimer
        key={restEnds}
        endsAt={restEnds}
        onSkip={() => setRestEnds(null)}
      />
    </>
  );
}
function ExerciseCard({
  item,
  onSet,
  onSkip,
  onSubstituted,
}: {
  item: RunnerExercise;
  onSet: (setId: string, patch: Partial<SetRow>) => void;
  onSkip: () => void;
  onSubstituted: (replacement: {
    exerciseId: string;
    exerciseName: string;
  }) => void;
}) {
  const [menu, setMenu] = useState(false);
  const completed = item.sets.every((s) => s.completed);
  if (item.status === "skipped")
    return (
      <Card className="p-5 opacity-60">
        <div className="flex items-center justify-between">
          <p className="font-semibold line-through">{item.detail.name}</p>
          <span className="text-sm text-muted">Pulado</span>
        </div>
      </Card>
    );
  return (
    <Card className={completed ? "border-success/50" : ""}>
      <div className="grid gap-4 p-4 sm:grid-cols-[180px_1fr]">
        <button
          className="overflow-hidden rounded-xl text-left"
          aria-label={`Ver execução de ${item.detail.name}`}
        >
          <ViewportVideo
            src={item.detail.mediaUrl}
            poster={item.detail.posterUrl}
            mediaType={item.detail.mediaType}
            className="w-full"
            priority={item.position === 1}
          />
        </button>
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{item.detail.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {item.detail.primaryMuscles.join(" · ")}
              </p>
            </div>
            {completed ? (
              <Check className="text-success" />
            ) : (
              <button
                onClick={() => setMenu(true)}
                className="grid size-11 place-items-center rounded-full hover:bg-surface-alt"
                aria-label="Opções"
              >
                <MoreHorizontal />
              </button>
            )}
          </div>
          <p className="mt-4 text-sm text-muted">
            {item.targetSets} séries · {item.repMin}–{item.repMax} reps ·{" "}
            {item.restSeconds}s
          </p>
        </div>
      </div>
      {item.category === "cardio" ? (
        <CardioEntry exerciseId={item.id} />
      ) : (
        <div className="border-t px-3 py-2">
          <div className="grid grid-cols-[44px_1fr_1fr_48px] items-center gap-2 px-1 pb-2 text-center text-xs uppercase tracking-wide text-muted">
            <span>Série</span>
            <span>kg</span>
            <span>reps</span>
            <span>feito</span>
          </div>
          {item.sets.map((set) => (
            <div
              key={set.id}
              className="grid grid-cols-[44px_1fr_1fr_48px] items-center gap-2 py-1"
            >
              <span className="text-center text-sm text-muted">
                {set.set_number}
              </span>
              <Input
                aria-label={`Carga da série ${set.set_number}`}
                className="h-11 text-center"
                inputMode="decimal"
                type="number"
                step="0.5"
                value={set.weight_kg ?? ""}
                onChange={(e) =>
                  onSet(set.id, {
                    weight_kg: e.target.value === "" ? null : +e.target.value,
                  })
                }
              />
              <Input
                aria-label={`Repetições da série ${set.set_number}`}
                className="h-11 text-center"
                inputMode="numeric"
                type="number"
                value={set.reps ?? ""}
                onChange={(e) =>
                  onSet(set.id, {
                    reps: e.target.value === "" ? null : +e.target.value,
                  })
                }
              />
              <button
                onClick={() => onSet(set.id, { completed: !set.completed })}
                aria-label={`${set.completed ? "Desmarcar" : "Concluir"} série ${set.set_number}`}
                className={`grid size-11 place-items-center rounded-xl ${set.completed ? "bg-success text-white" : "bg-surface-alt text-muted"}`}
              >
                {set.completed ? <Check size={20} /> : <Circle size={20} />}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t p-3">
        <ExerciseDetails exercise={item.detail} />
        <Button variant="ghost" onClick={() => setMenu(true)}>
          <SwitchCamera size={17} />
          Trocar
        </Button>
      </div>
      <Sheet open={menu} onOpenChange={setMenu} title="Opções do exercício">
        <p className="text-sm text-muted">
          Substituições compatíveis respeitam seus equipamentos e preferências.
        </p>
        <SubstitutionActions
          item={item}
          onDone={() => setMenu(false)}
          onSubstituted={onSubstituted}
        />
        <Button
          variant="danger"
          className="mt-5 w-full"
          onClick={() => {
            onSkip();
            setMenu(false);
          }}
        >
          <SkipForward size={17} />
          Pular exercício
        </Button>
      </Sheet>
    </Card>
  );
}
function CardioEntry({ exerciseId }: { exerciseId: string }) {
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [incline, setIncline] = useState("");
  const [resistance, setResistance] = useState("");
  const [rpe, setRpe] = useState("");
  async function save() {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    if (!user) return;
    const { error } = await createClient()
      .from("cardio_logs")
      .upsert(
        {
          user_id: user.id,
          session_exercise_id: exerciseId,
          modality: "cardio",
          duration_seconds: +minutes * 60,
          distance_km: distance ? +distance : null,
          incline: incline ? +incline : null,
          resistance: resistance ? +resistance : null,
          rpe: rpe ? +rpe : null,
        },
        { onConflict: "session_exercise_id" },
      );
    if (error) toast.error(error.message);
    else toast.success("Cardio salvo");
  }
  return (
    <div className="grid grid-cols-2 gap-3 border-t p-4 sm:grid-cols-5">
      <label className="text-xs text-muted">
        Tempo (min)
        <Input
          className="mt-1"
          type="number"
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
      </label>
      <label className="text-xs text-muted">
        Distância (km)
        <Input
          className="mt-1"
          type="number"
          step="0.1"
          inputMode="decimal"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
        />
      </label>
      <label className="text-xs text-muted">
        Inclinação (%)
        <Input
          className="mt-1"
          type="number"
          step="0.5"
          inputMode="decimal"
          value={incline}
          onChange={(e) => setIncline(e.target.value)}
        />
      </label>
      <label className="text-xs text-muted">
        Resistência
        <Input
          className="mt-1"
          type="number"
          inputMode="decimal"
          value={resistance}
          onChange={(e) => setResistance(e.target.value)}
        />
      </label>
      <label className="text-xs text-muted">
        RPE (1–10)
        <Input
          className="mt-1"
          type="number"
          min="1"
          max="10"
          inputMode="decimal"
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
        />
      </label>
      <Button className="col-span-2 sm:col-span-5" onClick={save}>
        Salvar cardio
      </Button>
    </div>
  );
}
function SubstitutionActions({
  item,
  onDone,
  onSubstituted,
}: {
  item: RunnerExercise;
  onDone: () => void;
  onSubstituted: (replacement: {
    exerciseId: string;
    exerciseName: string;
  }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  async function substitute(
    reason:
      "equipment_unavailable" | "temporarily_unavailable" | "user_requested",
  ) {
    setLoading(true);
    const { data, error } = await createClient().rpc(
      "substitute_workout_exercise",
      {
        p_session_exercise_id: item.id,
        p_reason: reason,
        p_equipment_id:
          reason === "equipment_unavailable"
            ? (item.requiredEquipmentIds[0] ?? null)
            : null,
        p_exclude_exercise_ids: excluded,
      },
    );
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as {
      eventId: string;
      exerciseId: string;
      exerciseName: string;
    };
    setExcluded((current) => [...current, result.exerciseId]);
    onSubstituted(result);
    toast.success(`Substituímos por ${result.exerciseName}`, {
      action: {
        label: "Desfazer",
        onClick: async () => {
          const { error: undoError } = await createClient().rpc(
            "undo_workout_substitution",
            { p_event_id: result.eventId },
          );
          if (undoError) toast.error(undoError.message);
          else {
            toast.success("Substituição desfeita");
            window.location.reload();
          }
        },
      },
      duration: 8000,
    });
    onDone();
  }
  return (
    <div className="mt-5 grid gap-2">
      <Button
        variant="secondary"
        disabled={loading || !item.requiredEquipmentIds.length}
        onClick={() => substitute("equipment_unavailable")}
      >
        Minha academia não tem
      </Button>
      <Button
        variant="secondary"
        disabled={loading}
        onClick={() => substitute("temporarily_unavailable")}
      >
        Indisponível hoje
      </Button>
      <Button
        variant="secondary"
        disabled={loading}
        onClick={() => substitute("user_requested")}
      >
        {excluded.length ? "Ver outra opção" : "Trocar por outra opção"}
      </Button>
      {loading && (
        <p className="text-center text-sm text-muted">
          Buscando uma alternativa compatível…
        </p>
      )}
    </div>
  );
}
