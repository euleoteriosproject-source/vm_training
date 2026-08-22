export type AuthOperation = "LOGIN" | "SIGNUP";

export type AuthFailureKind =
  | "invalid_credentials"
  | "existing_user"
  | "allowlist_denied"
  | "weak_password"
  | "network"
  | "unexpected";

export type ClassifiedAuthError = {
  kind: AuthFailureKind;
  userMessage: string;
  code: string;
  status: number | null;
  errorClass: string;
  reportable: boolean;
};

type ErrorRecord = {
  code?: unknown;
  status?: unknown;
  message?: unknown;
  name?: unknown;
};

function readError(error: unknown) {
  const record =
    error && typeof error === "object" ? (error as ErrorRecord) : {};
  const code = typeof record.code === "string" ? record.code : "unknown";
  const status =
    typeof record.status === "number" && Number.isFinite(record.status)
      ? record.status
      : null;
  const message =
    typeof record.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : "";
  const errorClass =
    typeof record.name === "string"
      ? record.name
      : error instanceof Error
        ? error.constructor.name
        : "UnknownError";
  return {
    code,
    status,
    errorClass,
    normalized: `${code} ${errorClass} ${message}`.toLowerCase(),
  };
}

export function classifyAuthError(
  error: unknown,
  operation: AuthOperation,
): ClassifiedAuthError {
  const details = readError(error);
  const result = (
    kind: AuthFailureKind,
    userMessage: string,
    reportable = false,
  ): ClassifiedAuthError => ({ kind, userMessage, reportable, ...details });

  if (
    details.code === "invalid_credentials" ||
    details.normalized.includes("invalid login credentials")
  )
    return result("invalid_credentials", "E-mail ou senha incorretos.");

  if (
    details.code === "user_already_exists" ||
    details.code === "email_exists" ||
    details.normalized.includes("already registered") ||
    details.normalized.includes("already exists")
  )
    return result(
      "existing_user",
      "Este e-mail já possui uma conta. Entre com sua senha.",
    );

  if (
    operation === "SIGNUP" &&
    (details.status === 403 ||
      details.normalized.includes("not authorized") ||
      details.normalized.includes("não autorizado") ||
      details.normalized.includes("nao autorizado"))
  )
    return result(
      "allowlist_denied",
      "Este e-mail não está autorizado para cadastro.",
    );

  if (
    details.code === "weak_password" ||
    details.normalized.includes("password should") ||
    details.normalized.includes("weak password")
  )
    return result(
      "weak_password",
      "A senha não atende aos requisitos de segurança.",
    );

  if (
    details.errorClass === "AuthRetryableFetchError" ||
    details.normalized.includes("failed to fetch") ||
    details.normalized.includes("fetch failed") ||
    details.normalized.includes("network")
  )
    return result(
      "network",
      "Não foi possível conectar ao serviço de autenticação.",
      true,
    );

  return result(
    "unexpected",
    "Não foi possível concluir agora. Tente novamente.",
    true,
  );
}
