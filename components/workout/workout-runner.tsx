"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Circle,
  Flag,
  MoreHorizontal,
  SkipForward,
  SwitchCamera,
  XCircle,
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
import type { SessionReplacementCandidate } from "@/lib/workout/session-swap";

type SetRow = {
  id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  completed: boolean;
  previous?: { weightKg: number | null; reps: number | null } | null;
};
type RunnerExercise = {
  id: string;
  planDayId: string | null;
  planSlotId: string | null;
  actualExerciseId: string;
  plannedExerciseId: string | null;
  position: number;
  status: string;
  targetSets: number;
  repMin: number | null;
  repMax: number | null;
  restSeconds: number;
  category: string;
  cardioCompleted: boolean;
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
  const [finishOpen, setFinishOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const completed = items.reduce(
    (sum, item) =>
      sum +
      (item.category === "cardio"
        ? Number(item.cardioCompleted)
        : item.sets.filter((set) => set.completed).length),
    0,
  );
  const total = items.reduce(
    (sum, item) => sum + (item.category === "cardio" ? 1 : item.sets.length),
    0,
  );
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
    if (completed === 0) return;
    setFinishing(true);
    await syncQueue();
    const { error } = await createClient().rpc("finish_workout", {
      p_session_id: sessionId,
      p_notes: notes || null,
      p_confirm_partial: progress < 100,
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
  async function cancel() {
    setFinishing(true);
    await syncQueue();
    const { error } = await createClient().rpc("cancel_workout", {
      p_session_id: sessionId,
      p_reason: notes || null,
    });
    if (error) {
      toast.error(error.message);
      setFinishing(false);
      return;
    }
    toast.info("Treino cancelado");
    router.replace("/workouts?view=history");
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
          <Button variant="secondary" onClick={() => setFinishOpen(true)}>
            <Flag size={17} />
            Finalizar
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
            onCardioComplete={() =>
              setItems((current) =>
                current.map((exercise) =>
                  exercise.id === item.id
                    ? { ...exercise, cardioCompleted: true }
                    : exercise,
                ),
              )
            }
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
                          primaryMuscles: replacement.primaryMuscles,
                          mediaUrl: replacement.mediaUrl,
                          posterUrl: replacement.posterUrl,
                          mediaType: replacement.mediaType,
                          mediaSource: null,
                        },
                      }
                    : exercise,
                ),
              )
            }
            onSubstitutionUndone={(previous) =>
              setItems((current) =>
                current.map((exercise) =>
                  exercise.id === item.id
                    ? {
                        ...exercise,
                        actualExerciseId: previous.exerciseId,
                        detail: previous.detail,
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
      <Sheet
        open={finishOpen}
        onOpenChange={(open) => {
          setFinishOpen(open);
          if (!open) setConfirmCancel(false);
        }}
        title="Finalizar treino"
      >
        <div className="rounded-2xl bg-surface-alt p-5">
          <p className="text-3xl font-semibold">{progress}%</p>
          <p className="mt-1 text-sm text-muted">
            {completed} de {total} séries concluídas ·{" "}
            {
              items.filter((item) =>
                item.category === "cardio"
                  ? item.cardioCompleted
                  : item.sets.some((set) => set.completed),
              ).length
            }{" "}
            de {items.length} exercícios iniciados
          </p>
        </div>
        {completed === 0 ? (
          <p className="mt-5 rounded-xl bg-warning/10 p-4 text-sm text-warning">
            Conclua pelo menos uma série ou atividade antes de finalizar. Se não
            puder continuar, cancele o treino abaixo.
          </p>
        ) : progress < 100 ? (
          <p className="mt-5 text-sm leading-6 text-muted">
            Ainda há {total - completed} séries pendentes. Ao confirmar, o
            histórico mostrará este treino como concluído parcialmente.
          </p>
        ) : (
          <p className="mt-5 text-sm text-muted">
            Tudo concluído. Ótimo trabalho.
          </p>
        )}
        <label className="mt-5 block text-sm font-medium">
          Observações (opcional)
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-accent"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Como foi o treino?"
          />
        </label>
        <Button
          className="mt-5 w-full"
          disabled={finishing || completed === 0}
          onClick={finish}
        >
          {progress < 100 ? "Concluir mesmo assim" : "Concluir treino"}
        </Button>
        <div className="mt-7 border-t pt-5">
          <p className="text-sm font-semibold">Cancelar não é concluir</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            O treino ficará registrado como cancelado e não contará no histórico
            de concluídos nem na frequência.
          </p>
          {confirmCancel ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmCancel(false)}
              >
                Voltar
              </Button>
              <Button variant="danger" disabled={finishing} onClick={cancel}>
                Confirmar cancelamento
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="mt-3 w-full text-danger"
              onClick={() => setConfirmCancel(true)}
            >
              <XCircle size={17} />
              Cancelar treino
            </Button>
          )}
        </div>
      </Sheet>
    </>
  );
}
function ExerciseCard({
  item,
  onSet,
  onSkip,
  onCardioComplete,
  onSubstituted,
  onSubstitutionUndone,
}: {
  item: RunnerExercise;
  onSet: (setId: string, patch: Partial<SetRow>) => void;
  onSkip: () => void;
  onCardioComplete: () => void;
  onSubstituted: (replacement: SessionReplacementCandidate) => void;
  onSubstitutionUndone: (previous: {
    exerciseId: string;
    detail: ExerciseDetail;
  }) => void;
}) {
  const [menu, setMenu] = useState(false);
  const completed =
    item.category === "cardio"
      ? item.cardioCompleted
      : item.sets.every((set) => set.completed);
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
        <ExerciseDetails
          exercise={item.detail}
          prescription={{
            sets: item.targetSets,
            repMin: item.repMin,
            repMax: item.repMax,
            restSeconds: item.restSeconds,
          }}
          onEquipmentUnavailable={() => setMenu(true)}
          onChangeExercise={() => setMenu(true)}
          trigger={
            <button
              className="overflow-hidden rounded-xl text-left"
              aria-label={`Ver detalhes de ${item.detail.name}`}
            >
              <ViewportVideo
                src={item.detail.mediaUrl}
                poster={item.detail.posterUrl}
                mediaType={item.detail.mediaType}
                className="w-full"
                priority={item.position === 1}
                playbackControl={false}
              />
            </button>
          }
        />
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
        <CardioEntry
          exerciseId={item.id}
          completed={item.cardioCompleted}
          onSaved={onCardioComplete}
        />
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
              className="border-t border-border/50 py-2 first:border-0"
            >
              <div className="grid grid-cols-[44px_1fr_1fr_48px] items-center gap-2">
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
              {set.previous && (
                <div className="ml-11 mt-1 flex items-center justify-between gap-2 px-2 text-xs text-muted">
                  <span>
                    Anterior: {set.previous.weightKg ?? "—"} kg ·{" "}
                    {set.previous.reps ?? "—"} reps
                  </span>
                  <button
                    className="min-h-9 rounded-lg px-3 font-semibold text-accent"
                    onClick={() =>
                      onSet(set.id, {
                        weight_kg: set.previous?.weightKg ?? null,
                        reps: set.previous?.reps ?? null,
                      })
                    }
                  >
                    Repetir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t p-3">
        <ExerciseDetails
          exercise={item.detail}
          prescription={{
            sets: item.targetSets,
            repMin: item.repMin,
            repMax: item.repMax,
            restSeconds: item.restSeconds,
          }}
          onEquipmentUnavailable={() => setMenu(true)}
          onChangeExercise={() => setMenu(true)}
        />
        <Button variant="ghost" onClick={() => setMenu(true)}>
          <SwitchCamera size={17} />
          Trocar
        </Button>
      </div>
      <Sheet open={menu} onOpenChange={setMenu} title="Opções do exercício">
        <p className="text-sm text-muted">
          Substituições compatíveis respeitam seus equipamentos e preferências.
        </p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
          Só hoje
        </p>
        <SubstitutionActions
          item={item}
          onDone={() => setMenu(false)}
          onSubstituted={onSubstituted}
          onSubstitutionUndone={onSubstitutionUndone}
        />
        {item.planDayId && item.planSlotId && (
          <div className="mt-5 border-t pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Próximos treinos
            </p>
            <Button asChild variant="secondary" className="mt-2 w-full">
              <Link
                href={`/workouts/${item.planDayId}?swap=${item.planSlotId}`}
              >
                Trocar no meu plano
              </Link>
            </Button>
            <p className="mt-2 text-xs leading-5 text-muted">
              Cria uma nova versão do plano. Este treino em andamento não é
              alterado.
            </p>
          </div>
        )}
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
function CardioEntry({
  exerciseId,
  completed,
  onSaved,
}: {
  exerciseId: string;
  completed: boolean;
  onSaved: () => void;
}) {
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
    else {
      onSaved();
      toast.success("Cardio salvo");
    }
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
        {completed ? "Cardio salvo" : "Salvar cardio"}
      </Button>
    </div>
  );
}
function SubstitutionActions({
  item,
  onDone,
  onSubstituted,
  onSubstitutionUndone,
}: {
  item: RunnerExercise;
  onDone: () => void;
  onSubstituted: (replacement: SessionReplacementCandidate) => void;
  onSubstitutionUndone: (previous: {
    exerciseId: string;
    detail: ExerciseDetail;
  }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<
    | "occupied_today"
    | "equipment_missing"
    | "exercise_dislike"
    | "user_choice"
    | "other"
  >("user_choice");
  const [candidates, setCandidates] = useState<SessionReplacementCandidate[]>(
    [],
  );
  const [selected, setSelected] = useState<SessionReplacementCandidate | null>(
    null,
  );
  const [persistChange, setPersistChange] = useState(false);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);

  async function loadCandidates(nextReason = reason) {
    setLoading(true);
    setCandidatesLoaded(false);
    setSelected(null);
    const params = new URLSearchParams({ reason: nextReason });
    if (nextReason === "equipment_missing" && item.requiredEquipmentIds[0])
      params.set("equipmentId", item.requiredEquipmentIds[0]);
    try {
      const response = await fetch(
        `/api/workouts/session-exercises/${item.id}/swap?${params}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        candidates?: SessionReplacementCandidate[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error);
      setCandidates(body.candidates ?? []);
      setCandidatesLoaded(true);
    } catch (error) {
      toast.error(
        substitutionErrorMessage(
          error instanceof Error ? error.message : "Falha ao buscar opções",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function substitute(candidate: SessionReplacementCandidate) {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/workouts/session-exercises/${item.id}/swap`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "replace",
            replacementExerciseId: candidate.exerciseId,
            replacementType: candidate.replacementType,
            reasonCode: reason,
            equipmentId:
              reason === "equipment_missing"
                ? (item.requiredEquipmentIds[0] ?? null)
                : null,
            persistChange,
          }),
        },
      );
      const result = (await response.json()) as {
        eventId?: string;
        error?: string;
      };
      if (!response.ok || !result.eventId) throw new Error(result.error);
      onSubstituted(candidate);
      toast.success(`Substituímos por ${candidate.exerciseName}`, {
        action: {
          label: "Desfazer",
          onClick: async () => {
            const undo = await fetch(
              `/api/workouts/session-exercises/${item.id}/swap`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  action: "undo",
                  eventId: result.eventId,
                }),
              },
            );
            if (!undo.ok)
              toast.error(
                "Não foi possível desfazer agora. Seu treino continua salvo.",
              );
            else {
              toast.success("Substituição desfeita");
              onSubstitutionUndone({
                exerciseId: item.actualExerciseId,
                detail: item.detail,
              });
            }
          },
        },
        duration: 8000,
      });
      onDone();
    } catch (error) {
      toast.error(
        substitutionErrorMessage(
          error instanceof Error ? error.message : "Falha na troca",
        ),
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mt-5 grid gap-2">
      <label className="text-sm font-medium">
        Motivo
        <select
          className="mt-2 w-full rounded-xl border bg-background px-3 py-2"
          value={reason}
          onChange={(event) => {
            const nextReason = event.target.value as typeof reason;
            setReason(nextReason);
            setCandidates([]);
            setCandidatesLoaded(false);
            setPersistChange(false);
          }}
        >
          <option value="user_choice">Quero outra opção</option>
          <option value="occupied_today">Está ocupado agora</option>
          <option
            value="equipment_missing"
            disabled={!item.requiredEquipmentIds.length}
          >
            Minha academia não tem
          </option>
          <option value="exercise_dislike">Não gosto deste exercício</option>
          <option value="other">Outro motivo</option>
        </select>
      </label>
      {!candidatesLoaded && !selected && (
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => void loadCandidates()}
        >
          {loading ? "Buscando…" : "Ver alternativas"}
        </Button>
      )}
      {candidatesLoaded && !candidates.length && (
        <p className="rounded-xl border p-3 text-sm text-muted">
          Não encontramos uma alternativa segura para esta sessão agora. Seu
          plano não foi alterado.
        </p>
      )}
      {candidates.map((candidate) => (
        <button
          type="button"
          key={candidate.exerciseId}
          className="grid overflow-hidden rounded-xl border text-left sm:grid-cols-[96px_1fr]"
          onClick={() => setSelected(candidate)}
        >
          <ViewportVideo
            src={candidate.mediaUrl}
            poster={candidate.posterUrl}
            mediaType={candidate.mediaType}
            className="aspect-video w-full sm:h-full"
          />
          <span className="p-3">
            <span className="font-semibold">{candidate.exerciseName}</span>
            <span className="mt-1 block text-xs text-muted">
              {candidate.reason}
            </span>
            <span className="mt-2 inline-flex rounded-full bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent">
              {candidate.replacementType === "DIRECT_EQUIVALENT"
                ? "Equivalente direto"
                : "Boa opção para seu objetivo"}
            </span>
          </span>
        </button>
      ))}
      {selected && (
        <div className="rounded-xl border border-accent/30 p-3">
          <p className="font-semibold">{selected.exerciseName}</p>
          <p className="mt-1 text-xs text-muted">
            {selected.goalAlignmentReason}
          </p>
          {(reason === "exercise_dislike" ||
            reason === "equipment_missing") && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={persistChange}
                onChange={(event) => setPersistChange(event.target.checked)}
              />
              <span>
                {reason === "exercise_dislike"
                  ? "Evitar este exercício nos próximos planos"
                  : "Este equipamento não existe na minha academia"}
              </span>
            </label>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Voltar
            </Button>
            <Button
              disabled={loading}
              onClick={() => void substitute(selected)}
            >
              {loading ? "Trocando…" : "Usar alternativa agora"}
            </Button>
          </div>
        </div>
      )}
      {loading && (
        <p className="text-center text-sm text-muted">
          Buscando uma alternativa compatível…
        </p>
      )}
    </div>
  );
}

function substitutionErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("nenhuma substituição compatível"))
    return "Não encontramos outra opção compatível agora.";
  if (normalized.includes("sessão") || normalized.includes("autenticado"))
    return "Atualize a página e tente novamente.";
  return "Não foi possível trocar este exercício agora.";
}
