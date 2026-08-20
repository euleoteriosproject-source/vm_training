"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { emailSchema, passwordSchema } from "@/lib/validation/schemas";

export function ResetForm({ update = false }: { update?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function submit(data: FormData) {
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      if (update) {
        const password = passwordSchema.parse(String(data.get("password")));
        const { error: e } = await supabase.auth.updateUser({ password });
        if (e) throw e;
        toast.success("Senha atualizada");
        router.replace("/today");
        router.refresh();
      } else {
        const email = emailSchema.parse(String(data.get("email")));
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        });
        if (e) throw e;
        setDone(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível continuar");
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="rounded-3xl border bg-surface p-8">
        <h1 className="text-2xl font-semibold">Verifique seu e-mail</h1>
        <p className="mt-3 text-muted">
          Enviamos um link seguro para redefinir sua senha.
        </p>
      </div>
    );
  return (
    <form action={submit} className="rounded-3xl border bg-surface p-8">
      <h1 className="text-2xl font-semibold">
        {update ? "Nova senha" : "Recuperar senha"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {update
          ? "Escolha uma senha com pelo menos 8 caracteres."
          : "Você receberá um link de recuperação."}
      </p>
      <label className="mt-6 block text-sm font-medium">
        {update ? "Nova senha" : "E-mail"}
        <Input
          className="mt-2"
          name={update ? "password" : "email"}
          type={update ? "password" : "email"}
          required
        />
      </label>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <Button disabled={busy} className="mt-6 w-full">
        {busy ? "Aguarde…" : update ? "Atualizar senha" : "Enviar link"}
      </Button>
    </form>
  );
}
