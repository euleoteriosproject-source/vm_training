"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search, ShieldCheck, SwitchCamera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ViewportVideo } from "@/components/video/viewport-video";
import type { PlanReplacementCandidate } from "@/lib/workout/plan-swap";

type RebalanceChange = {
  kind: "replacement" | "additional_adjustment";
  day: string;
  before: string;
  after: string;
};
type RebalancePreview = {
  planId: string;
  dayId: string;
  changes: RebalanceChange[];
};
type PlanChangeResult = {
  eventId: string;
  planId: string;
  dayId: string;
  exerciseName?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) throw new Error(body.error || "Falha na operação.");
  return body;
}

export function PlanExerciseSwap({
  slotId,
  exerciseName,
  initialOpen = false,
}: {
  slotId: string;
  exerciseName: string;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [limit, setLimit] = useState(5);
  const [candidates, setCandidates] = useState<PlanReplacementCandidate[]>([]);
  const [selected, setSelected] = useState<PlanReplacementCandidate | null>(
    null,
  );
  const [persistExclusion, setPersistExclusion] = useState(false);
  const [preview, setPreview] = useState<RebalancePreview | null>(null);

  useEffect(() => {
    if (initialOpen) void load("", 5);
    // Deep links only determine the initial sheet state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpen]);

  async function load(nextQuery = activeQuery, nextLimit = limit) {
    setLoading(true);
    setSelected(null);
    setPreview(null);
    try {
      const params = new URLSearchParams({ limit: String(nextLimit) });
      if (nextQuery) params.set("q", nextQuery);
      const response = await fetch(
        `/api/plans/exercises/${slotId}/swap?${params}`,
        { cache: "no-store" },
      );
      const body = await readJson<{ candidates: PlanReplacementCandidate[] }>(
        response,
      );
      setCandidates(body.candidates);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao buscar opções.",
      );
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && !candidates.length) void load("", 5);
    if (!nextOpen) {
      setSelected(null);
      setPreview(null);
    }
  }

  async function search() {
    const nextQuery = query.trim();
    setActiveQuery(nextQuery);
    setLimit(5);
    await load(nextQuery, 5);
  }

  async function undo(eventId: string) {
    try {
      const response = await fetch(
        `/api/plans/exercise-changes/${eventId}/undo`,
        { method: "POST" },
      );
      const result = await readJson<{ dayId: string }>(response);
      toast.success("Alteração desfeita");
      router.replace(`/workouts/${result.dayId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível desfazer agora.",
      );
    }
  }

  function finish(result: PlanChangeResult, message: string) {
    setOpen(false);
    toast.success(message, {
      action: { label: "Desfazer", onClick: () => void undo(result.eventId) },
      duration: 9000,
    });
    router.replace(`/workouts/${result.dayId}`);
    router.refresh();
  }

  async function replace() {
    if (!selected?.isEquivalent) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/plans/exercises/${slotId}/swap`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "replace",
          replacementExerciseId: selected.exerciseId,
          persistExclusion,
        }),
      });
      finish(await readJson<PlanChangeResult>(response), "Exercício alterado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na troca.");
    } finally {
      setBusy(false);
    }
  }

  async function previewRebalance() {
    if (!selected || selected.isEquivalent) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/plans/exercises/${slotId}/swap`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "preview-rebalance",
          desiredExerciseId: selected.exerciseId,
        }),
      });
      setPreview(await readJson<RebalancePreview>(response));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao preparar a prévia.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function activateRebalance() {
    if (!preview) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/plans/rebalances/${preview.planId}/activate`,
        { method: "POST" },
      );
      finish(await readJson<PlanChangeResult>(response), "Treino reorganizado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha na reorganização.",
      );
    } finally {
      setBusy(false);
    }
  }

  const total = candidates[0]?.totalCount ?? 0;
  return (
    <Sheet
      open={open}
      onOpenChange={handleOpen}
      title={`Trocar ${exerciseName}`}
      trigger={
        <Button
          type="button"
          variant="secondary"
          className="flex-1 sm:flex-none"
        >
          <SwitchCamera size={17} aria-hidden /> Trocar
        </Button>
      }
    >
      <p className="text-sm leading-6 text-muted">
        Estas opções mantêm a função deste exercício no seu treino.
      </p>
      <form
        className="mt-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Quero incluir um exercício específico"
          aria-label="Buscar exercício específico"
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading}
          aria-label="Buscar"
        >
          <Search size={18} />
        </Button>
      </form>
      {activeQuery && (
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-accent"
          onClick={() => {
            setQuery("");
            setActiveQuery("");
            setLimit(5);
            void load("", 5);
          }}
        >
          Voltar às equivalentes recomendadas
        </button>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Buscando opções…</p>
      ) : selected ? (
        <div className="mt-6">
          {selected.isEquivalent ? (
            <EquivalentConfirmation
              before={exerciseName}
              after={selected.exerciseName}
              persistExclusion={persistExclusion}
              busy={busy}
              onPersistExclusion={setPersistExclusion}
              onCancel={() => setSelected(null)}
              onConfirm={() => void replace()}
            />
          ) : preview ? (
            <RebalanceConfirmation
              preview={preview}
              busy={busy}
              onCancel={() => setPreview(null)}
              onConfirm={() => void activateRebalance()}
            />
          ) : (
            <SemanticWarning
              desiredName={selected.exerciseName}
              busy={busy}
              onBack={() => setSelected(null)}
              onPreview={() => void previewRebalance()}
            />
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.exerciseId}
              candidate={candidate}
              onSelect={() => setSelected(candidate)}
            />
          ))}
          {!candidates.length && (
            <div className="rounded-2xl border p-5 text-sm text-muted">
              {activeQuery
                ? "Nenhum exercício compatível encontrado para esta busca."
                : "Não há outra opção equivalente disponível com sua configuração atual."}
            </div>
          )}
          {!activeQuery && candidates.length < total && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                const nextLimit = Math.min(limit + 5, 20);
                setLimit(nextLimit);
                void load("", nextLimit);
              }}
            >
              Ver mais opções
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function CandidateCard({
  candidate,
  onSelect,
}: {
  candidate: PlanReplacementCandidate;
  onSelect: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-surface sm:grid sm:grid-cols-[116px_1fr]">
      <ViewportVideo
        src={candidate.mediaUrl}
        poster={candidate.posterUrl}
        mediaType={candidate.mediaType}
        className="aspect-video w-full sm:aspect-auto sm:h-full"
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{candidate.exerciseName}</h3>
            <p className="mt-1 text-xs text-muted">
              {candidate.equipmentNames.join(" · ") || "Peso corporal"}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">
            <CheckCircle2 size={13} /> Mídia
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">{candidate.reason}</p>
        <Button type="button" className="mt-4 w-full" onClick={onSelect}>
          {candidate.isEquivalent ? "Trocar" : "Quero este exercício"}
        </Button>
      </div>
    </article>
  );
}

function EquivalentConfirmation({
  before,
  after,
  persistExclusion,
  busy,
  onPersistExclusion,
  onCancel,
  onConfirm,
}: {
  before: string;
  after: string;
  persistExclusion: boolean;
  busy: boolean;
  onPersistExclusion: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-2xl border p-5">
      <ShieldCheck className="text-success" aria-hidden />
      <h3 className="mt-3 text-lg font-semibold">
        Confirmar troca equivalente?
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Trocar <strong className="text-foreground">{before}</strong> por{" "}
        <strong className="text-foreground">{after}</strong>?
      </p>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-surface-alt p-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-accent"
          checked={persistExclusion}
          onChange={(event) => onPersistExclusion(event.target.checked)}
        />
        <span>Não quero este exercício nos meus treinos futuros</span>
      </label>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="button" disabled={busy} onClick={onConfirm}>
          {busy ? "Validando…" : "Confirmar troca"}
        </Button>
      </div>
    </div>
  );
}

function SemanticWarning({
  desiredName,
  busy,
  onBack,
  onPreview,
}: {
  desiredName: string;
  busy: boolean;
  onBack: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/5 p-5">
      <h3 className="font-semibold text-warning">
        Esse exercício tem uma função diferente no treino.
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted">
        Podemos reorganizar seu treino para incluir {desiredName} sem perder o
        equilíbrio do plano. Nada será ativado sem sua confirmação.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onBack}
        >
          Voltar
        </Button>
        <Button type="button" disabled={busy} onClick={onPreview}>
          {busy ? "Validando…" : "Reorganizar treino"}
        </Button>
      </div>
    </div>
  );
}

function RebalanceConfirmation({
  preview,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: RebalancePreview;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold">Revise a reorganização</h3>
      <p className="mt-2 text-sm text-muted">
        A prévia passou pelos gates de objetivo, equipamento, diversidade e
        mídia.
      </p>
      <div className="mt-5 space-y-3">
        {preview.changes.map((change, index) => (
          <div
            key={`${change.kind}-${index}`}
            className="rounded-2xl border p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {change.kind === "replacement"
                ? "Sai / entra"
                : "Ajuste adicional"}{" "}
              · {change.day}
            </p>
            <dl className="mt-3 grid grid-cols-[58px_1fr] gap-y-2 text-sm">
              <dt className="text-muted">Antes</dt>
              <dd>{change.before}</dd>
              <dt className="text-muted">Depois</dt>
              <dd className="font-semibold">{change.after}</dd>
            </dl>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="button" disabled={busy} onClick={onConfirm}>
          {busy ? "Ativando…" : "Ativar novo plano"}
        </Button>
      </div>
    </div>
  );
}
