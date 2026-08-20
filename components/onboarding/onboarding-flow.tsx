"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const goals = [
  ["weight_loss", "Perder peso"],
  ["fat_loss", "Reduzir gordura corporal"],
  ["measurements", "Reduzir medidas"],
  ["muscle_gain", "Ganhar massa muscular"],
  ["strength", "Ganhar força"],
  ["posture", "Melhorar postura"],
  ["mobility", "Melhorar mobilidade"],
  ["conditioning", "Melhorar condicionamento"],
  ["cardio_endurance", "Aumentar resistência cardiovascular"],
  ["general_health", "Manutenção / saúde geral"],
] as const;
type Data = {
  displayName: string;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  goals: string[];
  sessionsPerWeek: number;
  sessionMinutes: number;
  cardioPreference: number;
  experience: string;
  trainingLocation: string;
  equipmentIds: string[];
  exercisePreferences: Record<string, "like" | "avoid">;
};
export function OnboardingFlow({
  profile,
  equipment,
  exercises,
}: {
  profile: {
    display_name: string | null;
    birth_date: string | null;
    height_cm: number | null;
  } | null;
  equipment: { id: string; name: string; slug: string }[];
  exercises: { id: string; name_pt: string; category: string }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Data>({
    displayName: profile?.display_name ?? "",
    birthDate: profile?.birth_date ?? "",
    heightCm: String(profile?.height_cm ?? ""),
    weightKg: "",
    goals: [],
    sessionsPerWeek: 3,
    sessionMinutes: 60,
    cardioPreference: 3,
    experience: "returning",
    trainingLocation: "full_gym",
    equipmentIds: [],
    exercisePreferences: {},
  });
  const titles = [
    "Sobre você",
    "Seus objetivos",
    "Sua rotina",
    "Preferências",
    "Equipamentos",
    "Exercícios",
    "Confirmar plano",
  ];
  const valid = useMemo(
    () =>
      step === 0
        ? data.displayName.length >= 2 &&
          !!data.birthDate &&
          +data.heightCm >= 100 &&
          +data.weightKg >= 30
        : step === 1
          ? data.goals.length > 0
          : true,
    [step, data],
  );
  function toggle(key: "goals" | "equipmentIds", value: string) {
    setData((d) => ({
      ...d,
      [key]: d[key].includes(value)
        ? d[key].filter((v) => v !== value)
        : [...d[key], value],
    }));
  }
  async function finish() {
    setBusy(true);
    try {
      const payload = {
        ...data,
        heightCm: +data.heightCm,
        weightKg: +data.weightKg,
        goals: data.goals.map((code, priority) => ({
          code,
          priority: priority + 1,
        })),
        exercisePreferences: Object.entries(data.exercisePreferences).map(
          ([exerciseId, preference]) => ({ exerciseId, preference }),
        ),
      };
      const supabase = createClient();
      const { error } = await supabase.rpc("complete_onboarding", { payload });
      if (error) throw error;
      toast.success("Perfil configurado");
      const response = await fetch("/api/plans/generate", { method: "POST" });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        status?: "draft" | "active";
      } | null;
      if (!response.ok) {
        toast.error(
          result?.error ??
            "Perfil salvo, mas não foi possível gerar o plano agora.",
          { duration: 8000 },
        );
      } else {
        toast.success(
          result?.status === "active"
            ? "Seu plano foi gerado e ativado"
            : "Seu plano foi criado e está aguardando a liberação dos vídeos",
          { duration: 8000 },
        );
      }
      router.replace("/today");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-8">
      <header>
        <div className="flex items-center justify-between">
          <span className="font-bold">
            <span className="text-accent">VM</span> Training
          </span>
          <span className="text-sm text-muted">
            {step + 1} de {titles.length}
          </span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((step + 1) / titles.length) * 100}%` }}
          />
        </div>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">
          {titles[step]}
        </h1>
      </header>
      <Card className="mt-6 p-5 md:p-7">
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm font-medium">
              Nome
              <Input
                className="mt-2"
                value={data.displayName}
                onChange={(e) =>
                  setData({ ...data, displayName: e.target.value })
                }
              />
            </label>
            <label className="text-sm font-medium">
              Nascimento
              <Input
                className="mt-2"
                type="date"
                value={data.birthDate}
                onChange={(e) =>
                  setData({ ...data, birthDate: e.target.value })
                }
              />
            </label>
            <label className="text-sm font-medium">
              Altura <span className="text-muted">cm</span>
              <Input
                className="mt-2"
                inputMode="numeric"
                type="number"
                value={data.heightCm}
                onChange={(e) => setData({ ...data, heightCm: e.target.value })}
              />
            </label>
            <label className="text-sm font-medium">
              Peso atual <span className="text-muted">kg</span>
              <Input
                className="mt-2"
                inputMode="decimal"
                type="number"
                step="0.1"
                value={data.weightKg}
                onChange={(e) => setData({ ...data, weightKg: e.target.value })}
              />
            </label>
          </div>
        )}
        {step === 1 && (
          <div>
            <p className="mb-4 text-sm text-muted">
              Selecione em ordem de prioridade. Toque novamente para remover.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {goals.map(([code, label]) => {
                const index = data.goals.indexOf(code);
                return (
                  <button
                    key={code}
                    onClick={() => toggle("goals", code)}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left text-sm",
                      index >= 0 && "border-accent bg-accent/10",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full bg-surface-alt text-xs",
                        index >= 0 && "bg-accent text-accent-foreground",
                      )}
                    >
                      {index >= 0 ? index + 1 : ""}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-7">
            <OptionGroup
              title="Quantas vezes por semana?"
              values={[2, 3, 4, 5]}
              selected={data.sessionsPerWeek}
              onSelect={(v) => setData({ ...data, sessionsPerWeek: v })}
            />
            <OptionGroup
              title="Duração preferida"
              values={[30, 45, 60, 75, 90]}
              selected={data.sessionMinutes}
              suffix=" min"
              onSelect={(v) => setData({ ...data, sessionMinutes: v })}
            />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-7">
            <label className="block text-sm font-medium">
              Quanto você gosta de cardio?
              <input
                aria-label="Preferência de cardio"
                className="mt-5 w-full accent-[var(--accent)]"
                type="range"
                min="1"
                max="5"
                value={data.cardioPreference}
                onChange={(e) =>
                  setData({ ...data, cardioPreference: +e.target.value })
                }
              />
              <div className="mt-2 flex justify-between text-xs text-muted">
                <span>Musculação</span>
                <span>Equilibrado</span>
                <span>Cardio</span>
              </div>
            </label>
            <SelectGroup
              label="Experiência"
              value={data.experience}
              onChange={(v) => setData({ ...data, experience: v })}
              options={[
                ["beginner", "Iniciante"],
                ["returning", "Voltando a treinar"],
                ["intermediate", "Intermediário"],
                ["advanced", "Avançado"],
              ]}
            />
            <SelectGroup
              label="Onde você treina?"
              value={data.trainingLocation}
              onChange={(v) => setData({ ...data, trainingLocation: v })}
              options={[
                ["full_gym", "Academia completa"],
                ["small_gym", "Academia pequena"],
                ["condo", "Condomínio"],
                ["home", "Casa"],
                ["other", "Outro"],
              ]}
            />
          </div>
        )}
        {step === 4 && (
          <div>
            <p className="mb-4 text-sm text-muted">
              Marque o que está disponível. Você poderá alterar depois.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {equipment.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggle("equipmentIds", item.id)}
                  className={cn(
                    "relative min-h-14 rounded-xl border px-3 text-sm",
                    data.equipmentIds.includes(item.id) &&
                      "border-accent bg-accent/10",
                  )}
                >
                  <Check
                    className={cn(
                      "absolute right-2 top-2 opacity-0",
                      data.equipmentIds.includes(item.id) && "opacity-100",
                    )}
                    size={14}
                  />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 5 && (
          <div>
            <p className="mb-4 text-sm text-muted">
              Opcional. Marque exercícios que você gosta ou prefere evitar.
            </p>
            <div className="max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
              {exercises.map((exercise) => {
                const preference = data.exercisePreferences[exercise.id];
                return (
                  <div
                    key={exercise.id}
                    className="flex min-h-14 items-center gap-2 rounded-xl border p-2 pl-3"
                  >
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {exercise.name_pt}
                    </span>
                    {(["like", "avoid"] as const).map((value) => (
                      <button
                        key={value}
                        onClick={() =>
                          setData((current) => {
                            const exercisePreferences = {
                              ...current.exercisePreferences,
                            };
                            if (exercisePreferences[exercise.id] === value)
                              delete exercisePreferences[exercise.id];
                            else exercisePreferences[exercise.id] = value;
                            return { ...current, exercisePreferences };
                          })
                        }
                        className={cn(
                          "min-h-11 rounded-xl px-3 text-xs",
                          preference === value
                            ? value === "like"
                              ? "bg-success/15 text-success"
                              : "bg-danger/15 text-danger"
                            : "bg-surface-alt text-muted",
                        )}
                      >
                        {value === "like" ? "Gosto" : "Evitar"}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {step === 6 && (
          <div className="space-y-5">
            <p className="text-sm text-muted">
              Seu plano será criado com base em:
            </p>
            <Summary label="Objetivo principal" value={goals.find(([code]) => code === data.goals[0])?.[1] ?? "—"} />
            <Summary label="Objetivos secundários" value={data.goals.slice(1).map((code) => goals.find(([item]) => item === code)?.[1]).filter(Boolean).join(", ") || "Nenhum"} />
            <Summary label="Treino" value={`${data.sessionsPerWeek}x por semana`} />
            <Summary label="Tempo" value={`${data.sessionMinutes} minutos`} />
            <Summary label="Preferência" value={`Cardio ${data.cardioPreference}/5`} />
            <Summary label="Equipamentos" value={`${data.equipmentIds.length} selecionados`} />
          </div>
        )}
      </Card>
      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            <ChevronLeft size={18} />
            Voltar
          </Button>
        )}
        <Button
          className="ml-auto"
          disabled={!valid || busy}
          onClick={() => (step < 6 ? setStep(step + 1) : finish())}
        >
          {busy ? (
            "Salvando…"
          ) : step < 6 ? (
            <>
              Continuar
              <ChevronRight size={18} />
            </>
          ) : (
            "Gerar meu plano"
          )}
        </Button>
      </div>
    </main>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b pb-4 last:border-0 last:pb-0">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
function OptionGroup({
  title,
  values,
  selected,
  suffix = "",
  onSelect,
}: {
  title: string;
  values: number[];
  selected: number;
  suffix?: string;
  onSelect: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="grid grid-cols-5 gap-2">
        {values.map((v) => (
          <button
            key={v}
            onClick={() => onSelect(v)}
            className={cn(
              "min-h-12 rounded-xl border text-sm",
              v === selected &&
                "border-accent bg-accent text-accent-foreground",
            )}
          >
            {v}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}
function SelectGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-12 w-full rounded-xl border bg-surface px-3"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
