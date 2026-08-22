"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { signInSchema, signUpSchema } from "@/lib/validation/schemas";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    const raw = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };
    const parsed = (mode === "login" ? signInSchema : signUpSchema).safeParse(
      raw,
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os dados");
      setBusy(false);
      return;
    }
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: raw.email,
          password: raw.password,
        });
        if (authError) throw authError;
        toast.success("Bem-vindo de volta");
        router.replace(params.get("next") || "/today");
        router.refresh();
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: raw.email,
          password: raw.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (authError) throw authError;
        if (data.session) {
          toast.success("Conta criada. Vamos configurar seu treino.");
          router.replace("/onboarding");
          router.refresh();
        } else {
          toast.success("Confira seu e-mail para confirmar o cadastro");
          router.push("/login?confirmed=pending");
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Não foi possível continuar";
      const normalized = message.toLowerCase();
      setError(
        normalized.includes("authorized") || normalized.includes("autorizado")
          ? "Este cadastro não está autorizado para esta aplicação."
          : normalized.includes("invalid login credentials")
            ? "E-mail ou senha inválidos."
            : normalized.includes("internal server error")
              ? "Não foi possível entrar agora. Tente novamente em instantes."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      action={submit}
      className="rounded-3xl border bg-surface p-6 shadow-xl shadow-black/5 md:p-8"
    >
      <h1 className="text-2xl font-semibold">
        {mode === "login" ? "Treine. Registre. Evolua." : "Criar sua conta"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "login"
          ? "Entre para acessar seu plano."
          : "Use o e-mail que recebeu o convite."}
      </p>
      <div className="mt-7 space-y-4">
        <label className="block text-sm font-medium">
          E-mail
          <Input
            className="mt-2"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Senha
          <Input
            className="mt-2"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
          />
        </label>
        {mode === "signup" && (
          <label className="block text-sm font-medium">
            Confirmar senha
            <Input
              className="mt-2"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <Button className="mt-6 w-full" size="lg" disabled={busy}>
        {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
      </Button>
      <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
        <Link
          className="text-muted hover:text-foreground"
          href={mode === "login" ? "/forgot-password" : "/login"}
        >
          {mode === "login" ? "Esqueci minha senha" : "Já tenho conta"}
        </Link>
        <Link
          className="font-medium text-accent"
          href={mode === "login" ? "/sign-up" : "/login"}
        >
          {mode === "login" ? "Criar conta" : "Entrar"}
        </Link>
      </div>
    </form>
  );
}
