"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Search, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import type {
  MediaReviewMethod,
  MediaReviewState,
} from "@/lib/media/operations";

export type ReviewCandidate = {
  id: string;
  status: string;
  reviewState: MediaReviewState;
  reviewMethod: MediaReviewMethod | null;
  reviewAgent: string | null;
  validationVersion: string | null;
  validationConfidence: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  originalFileUrl: string | null;
  licenseCode: string | null;
  licenseUrl: string | null;
  author: string | null;
  attributionText: string | null;
  matchScore: number | null;
  matchDetails: Record<string, boolean | number | string | string[]>;
  description: string;
  title: string;
  sourceVideoUrl: string | null;
  finalVideoUrl: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  qualityScore: number | null;
  mediaRole: "PRIMARY_DEMO" | "EDUCATIONAL" | "ALTERNATIVE_VARIATION" | null;
  executionQuality: string;
  processingError: string | null;
  exercise: {
    id: string;
    name: string;
    slug: string;
    movement: string;
    muscles: string[];
    equipment: string[];
    neededByPlan: boolean;
    neededBy: string[];
    readiness: {
      ready: boolean;
      hasApprovedPrimaryMedia: boolean;
      hasInstructions: boolean;
      hasEquipment: boolean;
      hasMovementPattern: boolean;
      hasPrimaryMuscles: boolean;
      active: boolean;
    } | null;
  };
};

const reviewChecks = [
  ["correct_exercise", "É exatamente o exercício correto"],
  ["compatible_equipment", "O equipamento é compatível"],
  ["start_position_visible", "A posição inicial está visível"],
  ["main_range_visible", "A amplitude principal está visível"],
  ["complete_repetition_visible", "A repetição completa está visível"],
  ["technically_acceptable", "A execução é tecnicamente aceitável"],
  ["sufficient_clarity", "O vídeo está suficientemente claro"],
  ["useful_framing", "O enquadramento permite entender"],
  ["no_blocking_elements", "Não há elementos inviabilizantes"],
  ["license_confirmed", "A licença foi confirmada"],
] as const;
export function MediaReview({
  candidates,
  exercises,
  counts,
  initialMedia,
  initialExercise,
}: {
  candidates: ReviewCandidate[];
  exercises: {
    id: string;
    name: string;
    hasMedia?: boolean;
    neededByPlan?: boolean;
    neededBy?: string[];
  }[];
  counts: {
    total: number;
    published: number;
    pending: number;
    missing: number;
    rejected: number;
  };
  initialMedia?: string;
  initialExercise?: string;
}) {
  const [filter, setFilter] = useState<
    "manual" | "automated" | "rejected" | "all"
  >("manual");
  const [search, setSearch] = useState("");
  const [upload, setUpload] = useState(Boolean(initialExercise));
  const shown = useMemo(
    () =>
      candidates
        .filter((item) => {
          const inTab =
            filter === "manual"
              ? item.reviewState === "MANUAL_REVIEW_REQUIRED"
              : filter === "automated"
                ? item.reviewState === "PUBLISHED" &&
                  item.reviewMethod === "automated"
                : filter === "rejected"
                  ? item.reviewState === "REJECTED"
                  : true;
          return (
            inTab &&
            (!search ||
              `${item.exercise.name} ${item.exercise.muscles.join(" ")} ${item.exercise.equipment.join(" ")}`
                .toLowerCase()
                .includes(search.toLowerCase()))
          );
        })
        .sort((a, b) => {
          if (a.id === initialMedia) return -1;
          if (b.id === initialMedia) return 1;
          if (a.exercise.neededByPlan !== b.exercise.neededByPlan)
            return a.exercise.neededByPlan ? -1 : 1;
          if (a.exercise.neededBy.length !== b.exercise.neededBy.length)
            return b.exercise.neededBy.length - a.exercise.neededBy.length;
          const score = (b.matchScore ?? 0) - (a.matchScore ?? 0);
          if (score) return score;
          if (a.licenseCode === "PD" && b.licenseCode !== "PD") return -1;
          if (b.licenseCode === "PD" && a.licenseCode !== "PD") return 1;
          return 0;
        }),
    [candidates, filter, search, initialMedia],
  );
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Exercícios" value={counts.total} />
        <Metric label="Publicados" value={counts.published} />
        <Metric label="Aguardando" value={counts.pending} />
        <Metric label="Sem mídia" value={counts.missing} />
        <Metric label="Rejeitados" value={counts.rejected} />
      </div>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3.5 text-muted" size={18} />
          <Input
            className="pl-10"
            placeholder="Nome, músculo ou equipamento"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="flex gap-2 overflow-x-auto">
          {(["manual", "automated", "rejected", "all"] as const).map(
            (value) => (
              <Button
                key={value}
                variant={filter === value ? "primary" : "secondary"}
                onClick={() => setFilter(value)}
              >
                {
                  {
                    manual: "Precisa de revisão",
                    automated: "Publicados automaticamente",
                    rejected: "Rejeitados",
                    all: "Todos",
                  }[value]
                }
              </Button>
            ),
          )}
          <Button onClick={() => setUpload(true)}>
            <Upload size={17} />
            Upload
          </Button>
        </div>
      </div>
      <div className="mt-7 space-y-5">
        {shown.map((item, index) => (
          <CandidateReview
            key={item.id}
            item={item}
            nextId={shown[index + 1]?.id}
          />
        ))}
        {!shown.length && (
          <Card className="p-8 text-center text-muted">
            Nenhuma mídia neste filtro.
          </Card>
        )}
      </div>
      <Sheet title="Upload manual" open={upload} onOpenChange={setUpload}>
        <ManualUpload exercises={exercises} initialExercise={initialExercise} />
      </Sheet>
    </div>
  );
}
function blockerLabel(owners: string[]) {
  if (owners.includes("VINICIUS") && owners.includes("MARLISE"))
    return "BLOCKING BOTH PLANS";
  if (owners.includes("VINICIUS")) return "BLOCKING VINICIUS";
  if (owners.includes("MARLISE")) return "BLOCKING MARLISE";
  return owners.length ? `BLOCKING ${owners.join(" + ")}` : "BLOCKING PLAN";
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </Card>
  );
}
function CandidateReview({
  item,
  nextId,
}: {
  item: ReviewCandidate;
  nextId?: string;
}) {
  const router = useRouter();
  const [checks, setChecks] = useState<boolean[]>(() =>
    reviewChecks.map(() => false),
  );
  const [notes, setNotes] = useState("");
  const [role, setRole] = useState<
    "PRIMARY_DEMO" | "EDUCATIONAL" | "ALTERNATIVE_VARIATION"
  >(item.mediaRole ?? "PRIMARY_DEMO");
  const [executionQuality, setExecutionQuality] = useState<
    "approved" | "acceptable"
  >(item.executionQuality === "acceptable" ? "acceptable" : "approved");
  const [rejectionReason, setRejectionReason] = useState("wrong_exercise");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const allChecked = checks.every(Boolean);
  async function review() {
    setBusy(true);
    const checklist = Object.fromEntries(
      reviewChecks.map(([key], index) => [key, checks[index]]),
    );
    const response = await fetch(`/api/admin/media/${item.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mediaRole: role,
        executionQuality,
        checklist,
        reviewNotes: notes || undefined,
        trimStart,
        trimEnd,
      }),
    });
    const body = (await response.json()) as { error?: string };
    if (response.ok) {
      toast.success("Revisão salva; mídia pronta para processamento");
      router.refresh();
    } else toast.error(body.error ?? "Falha na aprovação");
    setBusy(false);
  }
  async function runAction(action: "process" | "publish") {
    setBusy(true);
    const response = await fetch(`/api/admin/media/${item.id}/${action}`, {
      method: "POST",
    });
    const body = (await response.json()) as { error?: string };
    if (response.ok) {
      toast.success(
        action === "process" ? "Mídia processada" : "Mídia publicada",
      );
      router.refresh();
    } else toast.error(body.error ?? "Falha na operação");
    setBusy(false);
  }
  async function reject() {
    setBusy(true);
    const response = await fetch(`/api/admin/media/${item.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: rejectionReason,
        notes: notes || undefined,
      }),
    });
    if (response.ok) toast.success("Mídia rejeitada");
    else toast.error("Falha ao rejeitar");
    setBusy(false);
    router.refresh();
  }
  const positiveReasons = Array.isArray(item.matchDetails.positiveReasons)
    ? item.matchDetails.positiveReasons
    : [];
  const negativeReasons = Array.isArray(item.matchDetails.negativeReasons)
    ? item.matchDetails.negativeReasons
    : [];
  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-2">
        <section className="border-b p-5 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Dados do exercício
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{item.exercise.name}</h2>
          {item.exercise.neededByPlan && (
            <span className="mt-2 inline-flex rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              {blockerLabel(item.exercise.neededBy)}
            </span>
          )}
          <dl className="mt-5 grid gap-3 text-sm">
            <Data label="Movimento" value={item.exercise.movement} />
            <Data
              label="Equipamento"
              value={item.exercise.equipment.join(", ") || "—"}
            />
            <Data
              label="Músculos"
              value={item.exercise.muscles.join(", ") || "—"}
            />
          </dl>
          {item.exercise.readiness && (
            <div
              className={`mt-5 rounded-xl p-3 text-sm ${item.exercise.readiness.ready ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
            >
              <p className="font-semibold">
                {item.exercise.readiness.ready
                  ? "Ready to publish"
                  : "Missing:"}
              </p>
              {!item.exercise.readiness.ready && (
                <ul className="mt-1 list-inside list-disc text-xs">
                  {!item.exercise.readiness.hasApprovedPrimaryMedia && (
                    <li>approved primary video</li>
                  )}
                  {!item.exercise.readiness.hasInstructions && (
                    <li>instructions</li>
                  )}
                  {!item.exercise.readiness.hasEquipment && <li>equipment</li>}
                  {!item.exercise.readiness.hasMovementPattern && (
                    <li>movement pattern</li>
                  )}
                  {!item.exercise.readiness.hasPrimaryMuscles && (
                    <li>primary muscles</li>
                  )}
                </ul>
              )}
            </div>
          )}
          <div className="mt-6 grid grid-cols-2 gap-2">
            {reviewChecks.map(([, label], index) => (
              <button
                key={label}
                onClick={() =>
                  setChecks((current) =>
                    current.map((value, i) => (i === index ? !value : value)),
                  )
                }
                className={`flex min-h-12 items-center gap-2 rounded-xl border p-2 text-left text-xs ${checks[index] ? "border-success bg-success/10" : ""}`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full ${checks[index] ? "bg-success text-white" : "bg-surface-alt"}`}
                >
                  {checks[index] && <Check size={14} />}
                </span>
                {label}
              </button>
            ))}
          </div>
        </section>
        <section className="p-5">
          <p className="mb-2 text-xs font-semibold text-muted">SOURCE</p>
          <div className="overflow-hidden rounded-xl bg-black">
            {item.sourceVideoUrl ? (
              <video
                className="aspect-video w-full object-contain"
                src={item.sourceVideoUrl}
                controls
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="grid aspect-video place-items-center text-sm text-white/60">
                Arquivo será baixado e processado ao aprovar
              </div>
            )}
          </div>
          {item.sourceVideoUrl && !item.finalVideoUrl && (
            <>
              <p className="mb-2 mt-4 text-xs font-semibold text-muted">
                PREVIEW TRECHO {trimStart.toFixed(1)}s
                {trimEnd ? ` → ${trimEnd.toFixed(1)}s` : ""}
              </p>
              <video
                className="aspect-video w-full rounded-xl bg-black object-contain"
                src={`${item.sourceVideoUrl}#t=${trimStart}${trimEnd ? `,${trimEnd}` : ""}`}
                controls
                muted
                playsInline
                preload="metadata"
              />
            </>
          )}
          {item.finalVideoUrl && (
            <>
              <p className="mb-2 mt-4 text-xs font-semibold text-success">
                FINAL PROCESSADO
              </p>
              <video
                className="aspect-video w-full rounded-xl bg-black object-contain"
                src={item.finalVideoUrl}
                controls
                muted
                playsInline
                preload="metadata"
              />
            </>
          )}
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{item.title || "Vídeo candidato"}</p>
              <p className="mt-1 text-sm text-muted">{item.sourceName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  {item.licenseCode === "PD"
                    ? "PUBLIC DOMAIN"
                    : item.licenseCode || "LICENSE PENDING"}
                </span>
                <span className="inline-flex rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                  {item.reviewState.replaceAll("_", " ")}
                </span>
                {item.reviewMethod === "automated" && (
                  <span className="inline-flex rounded-full bg-surface-alt px-2.5 py-1 text-xs text-muted">
                    {item.reviewAgent ?? "agente automatizado"} · v
                    {item.validationVersion ?? "—"} ·{" "}
                    {item.validationConfidence}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-xs">
              <p className="rounded-full bg-accent/10 px-3 py-1 text-accent">
                Algorithm Match {item.matchScore ?? 0}%
              </p>
              <p className="mt-1 text-muted">
                Technical Review:{" "}
                {item.executionQuality === "unreviewed"
                  ? "Pending"
                  : item.executionQuality}
              </p>
            </div>
          </div>
          <dl className="mt-4 grid gap-2 text-sm">
            <Data label="Autor" value={item.author || "Não informado"} />
            <Data
              label="Resolução"
              value={
                item.width && item.height
                  ? `${item.width}×${item.height}`
                  : "Após processamento"
              }
            />
            <Data
              label="Duração"
              value={
                item.duration
                  ? `${item.duration.toFixed(1)}s`
                  : "Após processamento"
              }
            />
            <Data
              label="Correspondência"
              value={positiveReasons.join(", ") || "Revisão manual"}
            />
          </dl>
          {negativeReasons.length > 0 && (
            <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
              {negativeReasons.map((reason) => (
                <p key={reason}>⚠ {reason}</p>
              ))}
            </div>
          )}
          {item.description && (
            <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted">
              {item.description}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">
              Papel da mídia
              <select
                className="mt-1 h-11 w-full rounded-xl border bg-surface px-3"
                value={role}
                onChange={(event) => setRole(event.target.value as typeof role)}
              >
                <option value="PRIMARY_DEMO">Demonstração principal</option>
                <option value="EDUCATIONAL">Educativo</option>
                <option value="ALTERNATIVE_VARIATION">Variação</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Qualidade da execução
              <select
                className="mt-1 h-11 w-full rounded-xl border bg-surface px-3"
                value={executionQuality}
                onChange={(event) =>
                  setExecutionQuality(
                    event.target.value as typeof executionQuality,
                  )
                }
              >
                <option value="approved">Aprovada</option>
                <option value="acceptable">Aceitável</option>
              </select>
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">
              Início do corte
              <Input
                type="number"
                min="0"
                step="0.1"
                value={trimStart}
                onChange={(event) => setTrimStart(+event.target.value)}
              />
            </label>
            <label className="text-xs text-muted">
              Fim do corte
              <Input
                type="number"
                min="0"
                step="0.1"
                value={trimEnd ?? ""}
                onChange={(event) =>
                  setTrimEnd(
                    event.target.value ? +event.target.value : undefined,
                  )
                }
              />
            </label>
          </div>
          <label className="mt-3 block text-xs text-muted">
            Motivo da rejeição
            <select
              className="mt-1 h-11 w-full rounded-xl border bg-surface px-3"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
            >
              <option value="wrong_exercise">Exercício incorreto</option>
              <option value="wrong_equipment">Equipamento incorreto</option>
              <option value="poor_execution">Execução ruim</option>
              <option value="poor_visibility">Visibilidade ruim</option>
              <option value="incomplete_movement">Movimento incompleto</option>
              <option value="license_issue">Problema de licença</option>
              <option value="low_quality">Baixa qualidade</option>
              <option value="duplicate">Duplicada</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <textarea
            className="mt-3 min-h-20 w-full rounded-xl border bg-surface p-3 text-sm"
            placeholder="Notas da revisão / motivo de rejeição"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          {item.processingError && (
            <p className="mt-3 rounded-xl bg-danger/10 p-3 text-xs text-danger">
              {item.processingError}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              disabled={busy}
              onClick={reject}
            >
              <X size={17} />
              Rejeitar
            </Button>
            {item.status === "pending" && (
              <Button
                className="flex-1"
                disabled={busy || (role === "PRIMARY_DEMO" && !allChecked)}
                onClick={review}
              >
                {busy ? "Salvando…" : "Salvar revisão"}
              </Button>
            )}
            {["reviewing", "failed"].includes(item.status) && (
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => runAction("process")}
              >
                {busy
                  ? "Processando…"
                  : item.status === "failed"
                    ? "Tentar novamente"
                    : "Processar mídia"}
              </Button>
            )}
            {item.status === "processed" && (
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => runAction("publish")}
              >
                {busy ? "Publicando…" : "Publicar"}
              </Button>
            )}
          </div>
          {item.sourceUrl && (
            <a
              className="mt-4 block text-xs text-accent underline"
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir página original
            </a>
          )}
          {nextId && (
            <a
              className="mt-4 block text-right text-sm font-semibold text-accent"
              href={`/admin/media-review?media=${nextId}`}
            >
              Próximo candidato →
            </a>
          )}
        </section>
      </div>
    </Card>
  );
}
function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
function ManualUpload({
  exercises,
  initialExercise,
}: {
  exercises: {
    id: string;
    name: string;
    hasMedia?: boolean;
    neededByPlan?: boolean;
  }[];
  initialExercise?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sourceType, setSourceType] = useState<
    "self_produced" | "licensed_pack"
  >("self_produced");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  async function submit(form: FormData) {
    setBusy(true);
    const response = await fetch("/api/admin/media/upload", {
      method: "POST",
      body: form,
    });
    const body = (await response.json()) as { error?: string };
    if (response.ok) {
      toast.success("Vídeo processado e enviado para revisão");
      router.refresh();
    } else toast.error(body.error ?? "Falha no upload");
    setBusy(false);
  }
  return (
    <form action={submit} className="space-y-4">
      <label className="block text-sm">
        Exercício
        <select
          name="exerciseId"
          defaultValue={initialExercise}
          className="mt-2 h-12 w-full rounded-xl border bg-surface px-3"
        >
          {exercises.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Arquivo
        <input
          name="file"
          type="file"
          accept="video/mp4,video/webm,image/gif"
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreviewUrl(file ? URL.createObjectURL(file) : null);
          }}
          className="mt-2 block w-full text-sm"
        />
      </label>
      {previewUrl && (
        <video
          className="aspect-video w-full rounded-xl bg-black object-contain"
          src={previewUrl}
          controls
          muted
          playsInline
          preload="metadata"
        />
      )}
      <label className="block text-sm">
        Origem
        <select
          name="sourceType"
          value={sourceType}
          onChange={(event) =>
            setSourceType(event.target.value as typeof sourceType)
          }
          className="mt-2 h-12 w-full rounded-xl border bg-surface px-3"
        >
          <option value="self_produced">Produção própria</option>
          <option value="licensed_pack">Pacote licenciado</option>
        </select>
      </label>
      <label className="block text-sm">
        Papel inicial
        <select
          name="mediaRole"
          defaultValue="PRIMARY_DEMO"
          className="mt-2 h-12 w-full rounded-xl border bg-surface px-3"
        >
          <option value="PRIMARY_DEMO">Demonstração principal</option>
          <option value="EDUCATIONAL">Educativo</option>
          <option value="ALTERNATIVE_VARIATION">Variação</option>
        </select>
      </label>
      <input
        type="hidden"
        name="licenseCode"
        value={sourceType === "self_produced" ? "CUSTOM" : "VITAL-FREE-PACK"}
      />
      <label className="block text-sm">
        Nome da fonte
        <Input
          className="mt-2"
          name="sourceName"
          defaultValue={
            sourceType === "self_produced" ? "VM Training" : "Vital Animations"
          }
          required
        />
      </label>
      <label className="block text-sm">
        Autor
        <Input className="mt-2" name="author" />
      </label>
      <label className="block text-sm">
        Atribuição
        <textarea
          name="attributionText"
          className="mt-2 min-h-20 w-full rounded-xl border bg-surface p-3"
        />
      </label>
      <Button className="w-full" disabled={busy}>
        {busy ? "Processando com FFmpeg…" : "Enviar para revisão"}
      </Button>
    </form>
  );
}
