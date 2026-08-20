"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center text-center">
      <div>
        <h1 className="text-2xl font-semibold">
          Não conseguimos carregar esta parte.
        </h1>
        <p className="mt-2 text-muted">Sua sessão continua segura.</p>
        <Button className="mt-5" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
