"use server";

import {
  classifyAuthError,
  type AuthOperation,
  type ClassifiedAuthError,
} from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validation/schemas";

type AuthActionSuccess = { ok: true; redirectTo: string };
type AuthActionFailure = { ok: false; failure: ClassifiedAuthError };
export type AuthActionResult = AuthActionSuccess | AuthActionFailure;

function authFlowError(code: string, message: string, status = 500) {
  return Object.assign(new Error(message), {
    name: "AuthFlowError",
    code,
    status,
  });
}

function validationFailure(message: string): AuthActionFailure {
  return {
    ok: false,
    failure: {
      kind: "unexpected",
      userMessage: message,
      code: "validation_error",
      status: 400,
      errorClass: "ValidationError",
      reportable: false,
    },
  };
}

function safeRedirectPath(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/today";
}

function failureResult(
  error: unknown,
  operation: AuthOperation,
): AuthActionFailure {
  return { ok: false, failure: classifyAuthError(error, operation) };
}

export async function loginAction(input: {
  email: string;
  password: string;
  next?: string | null;
}): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success)
    return validationFailure(
      parsed.error.issues[0]?.message ?? "Revise os dados",
    );

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) throw error;
    if (!data.session)
      throw authFlowError("missing_login_session", "Login sem sessão");
    return { ok: true, redirectTo: safeRedirectPath(input.next) };
  } catch (error) {
    return failureResult(error, "LOGIN");
  }
}

export async function signupAction(input: {
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success)
    return validationFailure(
      parsed.error.issues[0]?.message ?? "Revise os dados",
    );

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) throw error;
    if (data.user?.identities?.length === 0)
      throw authFlowError("user_already_exists", "Usuário já cadastrado", 422);
    if (!data.session)
      throw authFlowError("missing_signup_session", "Cadastro sem sessão");
    return { ok: true, redirectTo: "/onboarding" };
  } catch (error) {
    return failureResult(error, "SIGNUP");
  }
}
