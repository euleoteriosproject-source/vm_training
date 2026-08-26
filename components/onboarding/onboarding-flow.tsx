"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  maskBrazilianDate,
  parseBrazilianDate,
  toBrazilianDate,
} from "@/lib/validation/dates";
import { onboardingSchema } from "@/lib/validation/schemas";
import { GOAL_OPTIONS } from "@/lib/workouts/goals";
import type { GoalCode } from "@/lib/workouts/types";

const gyms = [
  [
    "academia_essencial",
    "Academia essencial",
    "Equipamentos básicos e pesos livres",
  ],
  ["academia_padrao", "Academia padrão", "A estrutura mais comum de academia"],
  ["academia_completa", "Academia completa", "Máquinas e acessórios variados"],
  [
    "peso_livre_funcional",
    "Peso livre / funcional",
    "Halteres, barras, elásticos e corpo livre",
  ],
] as const;

const attentionRegions = [
  ["knee", "Joelho"],
  ["shoulder", "Ombro"],
  ["lower_back", "Lombar"],
  ["hip", "Quadril"],
  ["ankle", "Tornozelo"],
  ["wrist", "Punho"],
  ["other", "Outra região"],
] as const;

type GymCategory = (typeof gyms)[number][0];
type AttentionRegion = (typeof attentionRegions)[number][0];
type Data = {
  displayName: string;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  goalCode: GoalCode | "";
  sessionsPerWeek: number;
  sessionMinutes: number;
  experience: "beginner" | "returning" | "intermediate" | "advanced";
  gymCategory: GymCategory;
  movementAttention: AttentionRegion[];
};

export function OnboardingFlow({
  profile,
}: {
  profile: {
    display_name: string | null;
    birth_date: string | null;
    height_cm: number | null;
  } | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Data>({
    displayName: profile?.display_name ?? "",
    birthDate: toBrazilianDate(profile?.birth_date),
    heightCm: String(profile?.height_cm ?? ""),
    weightKg: "",
    goalCode: "",
    sessionsPerWeek: 3,
    sessionMinutes: 60,
    experience: "returning",
    gymCategory: "academia_padrao",
    movementAttention: [],
  });
  const titles = [
    "Seu ponto de partida",
    "Seu objetivo e rotina",
    "Onde você treina",
  ];
  const birthDateIso = parseBrazilianDate(data.birthDate);
  const valid = useMemo(() => {
    if (step === 0)
      return (
        data.displayName.trim().length >= 2 &&
        birthDateIso !== null &&
        +data.heightCm >= 100 &&
        +data.heightCm <= 250 &&
        +data.weightKg >= 30 &&
        +data.weightKg <= 400
      );
    if (step === 1) return data.goalCode !== "";
    return true;
  }, [birthDateIso, data, step]);

  function toggleAttention(value: AttentionRegion) {
    setData((current) => ({
      ...current,
      movementAttention: current.movementAttention.includes(value)
        ? current.movementAttention.filter((region) => region !== value)
        : [...current.movementAttention, value],
    }));
  }

  async function finish() {
    const parsed = onboardingSchema.safeParse({
      ...data,
      birthDate: birthDateIso,
      heightCm: Number(data.heightCm),
      weightKg: Number(data.weightKg),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise seus dados");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("complete_onboarding", {
        payload: parsed.data,
      });
      if (error) throw error;
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activation: "immediate" }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.error ?? "Não foi possível gerar o plano");
      toast.success("Seu plano está pronto para treinar");
      router.replace("/today");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível concluir",
      );
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
            <label className="text-sm font-medium sm:col-span-2">
              Nome
              <Input
                className="mt-2"
                autoComplete="name"
                value={data.displayName}
                onChange={(event) =>
                  setData({ ...data, displayName: event.target.value })
                }
              />
            </label>
            <label className="text-sm font-medium">
              Nascimento
              <Input
                className="mt-2"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                maxLength={10}
                value={data.birthDate}
                onChange={(event) =>
                  setData({
                    ...data,
                    birthDate: maskBrazilianDate(event.target.value),
                  })
                }
              />
              {data.birthDate.length === 10 && !birthDateIso && (
                <span className="mt-1 block text-xs text-danger">
                  Informe uma data válida.
                </span>
              )}
            </label>
            <label className="text-sm font-medium">
              Altura <span className="text-muted">cm</span>
              <Input
                className="mt-2"
                inputMode="numeric"
                type="number"
                min="100"
                max="250"
                value={data.heightCm}
                onChange={(event) =>
                  setData({ ...data, heightCm: event.target.value })
                }
              />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Peso atual <span className="text-muted">kg</span>
              <Input
                className="mt-2"
                inputMode="decimal"
                type="number"
                min="30"
                max="400"
                step="0.1"
                value={data.weightKg}
                onChange={(event) =>
                  setData({ ...data, weightKg: event.target.value })
                }
              />
              <span className="mt-1 block text-xs text-muted">
                Este será seu primeiro registro de evolução.
              </span>
            </label>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-7">
            <div>
              <p className="mb-3 text-sm font-medium">
                Qual é seu objetivo principal?
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {GOAL_OPTIONS.map(([code, label, description]) => (
                  <button
                    type="button"
                    aria-pressed={data.goalCode === code}
                    key={code}
                    onClick={() => setData({ ...data, goalCode: code })}
                    className={cn(
                      "min-h-12 rounded-xl border px-3 text-left text-sm",
                      data.goalCode === code && "border-accent bg-accent/10",
                    )}
                  >
                    {label}
                    <span className="mt-1 block text-xs leading-5 text-muted">
                      {description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <OptionGroup
              title="Quantas vezes por semana?"
              values={[2, 3, 4, 5]}
              selected={data.sessionsPerWeek}
              onSelect={(value) => setData({ ...data, sessionsPerWeek: value })}
            />
            <OptionGroup
              title="Duração preferida"
              values={[30, 45, 60, 75, 90]}
              selected={data.sessionMinutes}
              suffix=" min"
              onSelect={(value) => setData({ ...data, sessionMinutes: value })}
            />
            <SelectGroup
              label="Experiência"
              value={data.experience}
              onChange={(value) =>
                setData({ ...data, experience: value as Data["experience"] })
              }
              options={[
                ["beginner", "Iniciante"],
                ["returning", "Voltando a treinar"],
                ["intermediate", "Intermediário"],
                ["advanced", "Avançado"],
              ]}
            />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-7">
            <div>
              <p className="mb-3 text-sm font-medium">
                Qual estrutura mais se parece com a sua?
              </p>
              <div className="grid gap-2">
                {gyms.map(([code, label, description]) => (
                  <button
                    type="button"
                    aria-pressed={data.gymCategory === code}
                    key={code}
                    onClick={() => setData({ ...data, gymCategory: code })}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left",
                      data.gymCategory === code && "border-accent bg-accent/10",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full bg-surface-alt",
                        data.gymCategory === code &&
                          "bg-accent text-accent-foreground",
                      )}
                    >
                      <Check size={15} />
                    </span>
                    <span>
                      <strong className="block text-sm">{label}</strong>
                      <span className="text-xs text-muted">{description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">
                Alguma região exige atenção?
              </p>
              <p className="mb-3 mt-1 text-xs text-muted">
                Opcional. Isso ajuda nas substituições durante o treino.
              </p>
              <div className="flex flex-wrap gap-2">
                {attentionRegions.map(([code, label]) => (
                  <button
                    type="button"
                    aria-pressed={data.movementAttention.includes(code)}
                    key={code}
                    onClick={() => toggleAttention(code)}
                    className={cn(
                      "min-h-11 rounded-xl border px-3 text-sm",
                      data.movementAttention.includes(code) &&
                        "border-accent bg-accent/10",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="rounded-xl bg-surface-alt p-3 text-sm text-muted">
              Vamos considerar automaticamente os equipamentos mais comuns dessa
              estrutura. Se algo estiver indisponível no dia, você troca com um
              toque.
            </p>
          </div>
        )}
      </Card>
      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setStep(step - 1)}
          >
            <ChevronLeft size={18} />
            Voltar
          </Button>
        )}
        <Button
          className="ml-auto"
          disabled={!valid || busy}
          onClick={() =>
            step < titles.length - 1 ? setStep(step + 1) : finish()
          }
        >
          {busy ? (
            "Preparando seu plano…"
          ) : step < titles.length - 1 ? (
            <>
              Continuar
              <ChevronRight size={18} />
            </>
          ) : (
            "Criar meu plano"
          )}
        </Button>
      </div>
    </main>
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
  onSelect: (value: number) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="grid grid-cols-5 gap-2">
        {values.map((value) => (
          <button
            type="button"
            aria-pressed={value === selected}
            key={value}
            onClick={() => onSelect(value)}
            className={cn(
              "min-h-12 rounded-xl border text-sm",
              value === selected &&
                "border-accent bg-accent text-accent-foreground",
            )}
          >
            {value}
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
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-xl border bg-surface px-3"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
