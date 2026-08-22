"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  classifyAuthError,
  type AuthOperation,
  type ClassifiedAuthError,
} from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";
import { signInSchema, signUpSchema } from "@/lib/validation/schemas";

function correlationId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
  );
}

function traceAuth(
  event: string,
  context: { operation: AuthOperation; requestId: string; code?: string },
) {
  console.info("VM_AUTH_TRACE", { event, ...context });
}

function authFlowError(code: string, message: string, status = 500) {
  return Object.assign(new Error(message), {
    name: "AuthFlowError",
    code,
    status,
  });
}

async function reportAuthFailure(
  failure: ClassifiedAuthError,
  operation: AuthOperation,
  requestId: string,
) {
  if (!failure.reportable) return;
  const safe = (value: string) =>
    value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80) || "unknown";
  try {
    await fetch("/api/auth/diagnostics", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation,
        code: safe(failure.code),
        status: failure.status,
        errorClass: safe(failure.errorClass),
        route: window.location.pathname,
        requestId,
      }),
    });
  } catch {
    // Diagnostics must never replace the original user-facing error.
  }
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const operation: AuthOperation = mode === "login" ? "LOGIN" : "SIGNUP";
    const requestId = correlationId();
    traceAuth(`AUTH_${operation}_ACTION_START`, { operation, requestId });
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
      traceAuth("AUTH_CLIENT_CREATED", { operation, requestId });
      if (mode === "login") {
        traceAuth("AUTH_SIGNIN_CALL_START", { operation, requestId });
        const { data, error: authError } =
          await supabase.auth.signInWithPassword({
            email: raw.email,
            password: raw.password,
          });
        traceAuth("AUTH_SIGNIN_RESULT", {
          operation,
          requestId,
          code:
            authError?.code ??
            (data.session ? "session_created" : "no_session"),
        });
        if (authError) throw authError;
        if (!data.session)
          throw authFlowError("missing_login_session", "Login sem sessão");
        traceAuth("AUTH_SESSION_CREATED", { operation, requestId });
        toast.success("Bem-vindo de volta");
        traceAuth("AUTH_REDIRECT_START", { operation, requestId });
        router.replace(params.get("next") || "/today");
        router.refresh();
      } else {
        traceAuth("AUTH_SIGNUP_CALL_START", { operation, requestId });
        const { data, error: authError } = await supabase.auth.signUp({
          email: raw.email,
          password: raw.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        traceAuth("AUTH_SIGNUP_RESULT", {
          operation,
          requestId,
          code:
            authError?.code ??
            (data.session ? "session_created" : "no_session"),
        });
        if (authError) throw authError;
        if (data.user?.identities?.length === 0)
          throw authFlowError(
            "user_already_exists",
            "Usuário já cadastrado",
            422,
          );
        if (!data.session)
          throw authFlowError("missing_signup_session", "Cadastro sem sessão");
        traceAuth("AUTH_SESSION_CREATED", { operation, requestId });
        toast.success("Conta criada. Vamos configurar seu treino.");
        traceAuth("AUTH_REDIRECT_START", { operation, requestId });
        router.replace("/onboarding");
        router.refresh();
      }
    } catch (err) {
      const failure = classifyAuthError(err, operation);
      traceAuth(`AUTH_${operation}_ERROR`, {
        operation,
        requestId,
        code: failure.kind,
      });
      void reportAuthFailure(failure, operation, requestId);
      setError(failure.userMessage);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
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
        <div>
          <label className="block text-sm font-medium">
            Senha
            <Input
              aria-describedby={
                mode === "signup" ? "signup-password-requirements" : undefined
              }
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
            <p
              id="signup-password-requirements"
              className="mt-2 text-xs font-normal text-muted"
            >
              Use 12 ou mais caracteres, com maiúscula, minúscula e número.
            </p>
          )}
        </div>
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
      <Button type="submit" className="mt-6 w-full" size="lg" disabled={busy}>
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
