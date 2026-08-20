"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
export function RestTimer({
  endsAt,
  onSkip,
}: {
  endsAt: number | null;
  onSkip: () => void;
}) {
  const [clock, setClock] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => {
      const current = new Date().getTime();
      setClock(current);
      if (endsAt + extra <= current) onSkip();
    }, 250);
    return () => clearInterval(id);
  }, [endsAt, extra, onSkip]);
  if (!endsAt || clock === null) return null;
  const remaining = Math.max(0, Math.ceil((endsAt + extra - clock) / 1000));
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-lg items-center gap-4 rounded-2xl border bg-surface/95 p-3 shadow-2xl backdrop-blur md:bottom-6">
      <div className="min-w-20">
        <p className="text-xs text-muted">Descanso</p>
        <p className="font-mono text-xl font-semibold">
          {formatDuration(remaining)}
        </p>
      </div>
      <Button
        variant="secondary"
        className="ml-auto"
        onClick={() => setExtra((v) => v + 30000)}
      >
        +30 s
      </Button>
      <Button variant="ghost" onClick={onSkip}>
        Pular
      </Button>
    </div>
  );
}
