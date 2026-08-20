import Link from "next/link";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-between px-6 py-8 md:px-10">
      <header className="flex items-center justify-between">
        <div className="text-lg font-bold tracking-tight">
          <span className="text-accent">VM</span> Training
        </div>
        <Button asChild variant="secondary">
          <Link href="/login">Entrar</Link>
        </Button>
      </header>
      <section className="max-w-3xl py-20">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-2 text-sm text-muted">
          <ShieldCheck size={16} className="text-accent" /> Privado por padrão
        </div>
        <h1 className="text-balance text-5xl font-semibold tracking-[-.05em] md:text-7xl">
          Treine com intenção.
          <br />
          <span className="text-muted">Evolua com clareza.</span>
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-muted">
          Seu plano, suas séries e sua evolução em uma experiência rápida o
          bastante para acompanhar o ritmo do treino.
        </p>
        <Button asChild size="lg" className="mt-9">
          <Link href="/login">
            Começar <ArrowRight size={18} />
          </Link>
        </Button>
      </section>
      <footer className="flex items-center gap-2 py-4 text-sm text-muted">
        <Activity size={16} /> Organização de treino. Não substitui orientação
        profissional.
      </footer>
    </main>
  );
}
