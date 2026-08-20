import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export default function SetupPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <Card className="max-w-xl p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">
          Configuração necessária
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Conecte o Supabase</h1>
        <p className="mt-4 leading-7 text-muted">
          Copie <code>.env.example</code> para <code>.env.local</code>, informe
          a URL e a publishable key do projeto, e aplique as migrations. Nenhum
          secret é enviado ao navegador.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl bg-background p-4 text-sm text-muted">
          pnpm db:reset{`\n`}pnpm dev
        </pre>
        <Button asChild className="mt-6">
          <Link href="/">Voltar</Link>
        </Button>
      </Card>
    </main>
  );
}
