"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GeneratePlanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/plans/generate", { method: "POST" });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        status?: "draft" | "active";
      } | null;
      if (!response.ok)
        throw new Error(
          result?.error ?? "Não foi possível gerar o plano agora.",
        );
      setNotice(
        result?.status === "active"
          ? "Plano completo gerado e ativado. Todas as demonstrações estão disponíveis."
          : "Rascunho atualizado. Ele será liberado quando todas as demonstrações necessárias forem aprovadas.",
      );
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar o plano agora.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <Button onClick={generate} disabled={busy}>
        <RefreshCw className={busy ? "animate-spin" : ""} size={17} />
        {busy ? "Verificando catálogo…" : "Tentar gerar novamente"}
      </Button>
      {error && (
        <p
          role="alert"
          className="mt-3 max-w-xl rounded-xl bg-danger/10 p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 max-w-xl rounded-xl bg-success/10 p-3 text-sm text-success">
          {notice}
        </p>
      )}
    </div>
  );
}
