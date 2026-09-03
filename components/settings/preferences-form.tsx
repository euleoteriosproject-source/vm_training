"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Dumbbell, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { GOAL_OPTIONS, goalLabel } from "@/lib/workouts/goals";
import type { GoalCode, WorkoutStyle } from "@/lib/workouts/types";
import { cn } from "@/lib/utils";

type Preferences = {
  sessions_per_week: number;
  session_minutes: number;
  cardio_preference: number;
  gym_profile: string;
  workout_style: WorkoutStyle;
};

type PlanPreview = {
  id: string;
  goal: GoalCode;
  daysPerWeek: number;
  sessionMinutes: number;
  structure: string;
  exercisesPerDay: number[];
  changes: string[];
  gymEquipmentSlots: number;
  gymEquipmentPercent: number;
  machineCableSlots: number;
  freeWeightSlots: number;
  bodyweightFloorSlots: number;
  bodyweightPercent: number;
};

const styleOptions: Array<[WorkoutStyle, string, string]> = [
  [
    "gym_first",
    "Academia / máquinas",
    "Prioriza máquinas, cabos e equipamentos comuns de academia.",
  ],
  ["mixed", "Misto", "Equilibra máquinas, pesos livres e peso corporal."],
  ["free_weight", "Peso livre", "Dá mais espaço a halteres e barras."],
];

export function PreferencesForm({
  preferences,
  goal,
}: {
  preferences: Preferences;
  goal: GoalCode;
}) {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState(goal);
  const [days, setDays] = useState(preferences.sessions_per_week);
  const [minutes, setMinutes] = useState(preferences.session_minutes);
  const [cardio, setCardio] = useState(preferences.cardio_preference);
  const [workoutStyle, setWorkoutStyle] = useState(preferences.workout_style);
  const [busy, setBusy] = useState(false);
  const [savedChange, setSavedChange] = useState(false);
  const [preview, setPreview] = useState<PlanPreview | null>(null);

  async function save() {
    setBusy(true);
    const { error } = await createClient().rpc(
      "save_training_preferences_v215",
      {
        p_goal_code: selectedGoal,
        p_sessions_per_week: days,
        p_session_minutes: minutes,
        p_cardio_preference: cardio,
        p_gym_profile: "STANDARD_COMMERCIAL_GYM",
        p_workout_style: workoutStyle,
      },
    );
    setBusy(false);
    if (error) {
      toast.error("Não foi possível salvar suas preferências.");
      return false;
    }
    // A successful save must always expose the explicit preview flow. This lets
    // existing users request the latest generator without inventing a preference
    // change, while their current plan remains active until confirmation.
    setSavedChange(true);
    setPreview(null);
    toast.success("Suas preferências foram atualizadas.");
    router.refresh();
    return true;
  }

  async function generatePreview() {
    setBusy(true);
    try {
      const response = await fetch("/api/plans/generate", { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; preview?: PlanPreview }
        | null;
      if (!response.ok || !body?.preview)
        throw new Error(body?.error ?? "Não foi possível gerar o novo treino.");
      setPreview(body.preview);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o novo treino.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function activatePreview() {
    if (!preview) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/plans/${preview.id}/activate`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok)
        throw new Error(
          body?.error ?? "Não foi possível ativar o novo treino.",
        );
      toast.success("Novo treino ativado. O plano anterior foi preservado.");
      router.push("/workouts");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar o novo treino.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <section>
        <h2 className="text-base font-semibold">Objetivo</h2>
        <p className="mt-1 text-sm text-muted">
          O objetivo muda exercícios, volume, repetições, descanso e presença de
          cardio.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map(([code, label, description]) => (
            <button
              type="button"
              aria-label={`${label}. ${description}`}
              aria-pressed={selectedGoal === code}
              key={code}
              onClick={() => setSelectedGoal(code)}
              className={cn(
                "min-h-20 rounded-xl border p-3 text-left transition-colors",
                selectedGoal === code && "border-accent bg-accent/10",
              )}
            >
              <strong className="block text-sm">{label}</strong>
              <span className="mt-1 block text-xs leading-5 text-muted">
                {description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <Group
        label="Treinos por semana"
        values={[2, 3, 4, 5]}
        value={days}
        onChange={setDays}
      />
      <Group
        label="Minutos por treino"
        values={[30, 45, 60, 75, 90]}
        value={minutes}
        onChange={setMinutes}
      />

      <label className="block text-sm font-medium">
        Preferência por cardio: {cardio}/5
        <input
          aria-label="Preferência por cardio"
          className="mt-4 w-full accent-[var(--accent)]"
          type="range"
          min="1"
          max="5"
          value={cardio}
          onChange={(event) => setCardio(Number(event.target.value))}
        />
      </label>

      <section>
        <h2 className="text-base font-semibold">Estilo de treino</h2>
        <p className="mt-1 text-sm text-muted">
          Escolha a combinação de equipamentos que deve receber prioridade.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {styleOptions.map(([code, label, description]) => (
            <button
              type="button"
              aria-label={`${label}. ${description}`}
              aria-pressed={workoutStyle === code}
              key={code}
              onClick={() => setWorkoutStyle(code)}
              className={cn(
                "min-h-24 rounded-xl border p-3 text-left transition-colors",
                workoutStyle === code && "border-accent bg-accent/10",
              )}
            >
              <strong className="block text-sm">{label}</strong>
              <span className="mt-1 block text-xs leading-5 text-muted">
                {description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-surface-alt p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <Dumbbell size={19} />
          </span>
          <div>
            <h2 className="font-semibold">Academia comercial padrão</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Priorizamos máquinas, cabos e equipamentos comuns de academia.
              Pesos livres e exercícios no chão entram quando fizerem sentido
              para o seu objetivo. Se algum aparelho não estiver disponível,
              você pode trocar o exercício durante o treino.
            </p>
          </div>
        </div>
      </section>

      <Button className="w-full sm:w-auto" onClick={save} disabled={busy}>
        {busy ? "Salvando…" : "Salvar preferências"}
      </Button>

      {savedChange && !preview && (
        <Card className="border-success/30 bg-success/5 p-5">
          <div className="flex gap-3">
            <CheckCircle2
              className="mt-0.5 shrink-0 text-success"
              size={20}
            />
            <div>
              <p className="font-semibold">
                Suas preferências foram atualizadas.
              </p>
              <p className="mt-1 text-sm text-muted">
                Seu treino atual continua ativo.
              </p>
              <Button
                className="mt-4"
                onClick={generatePreview}
                disabled={busy}
              >
                <Sparkles size={17} />
                Atualizar meu treino
              </Button>
            </div>
          </div>
        </Card>
      )}

      {preview && (
        <Card className="border-accent/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Prévia do novo plano
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {goalLabel(preview.goal)}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Summary
              label="Frequência"
              value={`${preview.daysPerWeek}x/semana`}
            />
            <Summary label="Duração" value={`${preview.sessionMinutes} min`} />
            <Summary label="Estrutura" value={preview.structure} />
            <Summary
              label="Exercícios"
              value={preview.exercisesPerDay.join(" · ")}
            />
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-accent/5 p-3 text-sm sm:grid-cols-4">
            <Summary
              label="Equipamentos de academia"
              value={`${preview.gymEquipmentPercent}%`}
            />
            <Summary
              label="Máquinas e cabos"
              value={`${preview.machineCableSlots} exercícios`}
            />
            <Summary
              label="Pesos livres"
              value={`${preview.freeWeightSlots} exercícios`}
            />
            <Summary
              label="Peso corporal / chão"
              value={`${preview.bodyweightFloorSlots} (${preview.bodyweightPercent}%)`}
            />
          </div>
          {preview.changes.length > 0 && (
            <div className="mt-4 rounded-xl bg-surface-alt p-3 text-sm text-muted">
              <strong className="text-foreground">Principais mudanças</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {preview.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-sm text-muted">
            Seu plano atual só será arquivado depois da sua confirmação.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              onClick={() => setPreview(null)}
              disabled={busy}
            >
              Manter treino atual
            </Button>
            <Button onClick={activatePreview} disabled={busy}>
              {busy ? "Ativando…" : "Confirmar e ativar"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Group({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium">{label}</h2>
      <div className="mt-3 flex gap-2">
        {values.map((candidate) => (
          <button
            type="button"
            aria-pressed={value === candidate}
            key={candidate}
            onClick={() => onChange(candidate)}
            className={cn(
              "min-h-12 flex-1 rounded-xl border text-sm",
              value === candidate &&
                "border-accent bg-accent text-accent-foreground",
            )}
          >
            {candidate}
          </button>
        ))}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
