import { describe, expect, it } from "vitest";
import { classifyAuthError } from "./errors";

describe("classifyAuthError", () => {
  it.each([
    [
      { code: "invalid_credentials", status: 400 },
      "LOGIN",
      "invalid_credentials",
      "E-mail ou senha incorretos.",
    ],
    [
      { code: "user_already_exists", status: 422 },
      "SIGNUP",
      "existing_user",
      "Este e-mail já possui uma conta. Entre com sua senha.",
    ],
    [
      { message: "Este cadastro não está autorizado", status: 403 },
      "SIGNUP",
      "allowlist_denied",
      "Este e-mail não está autorizado para cadastro.",
    ],
    [
      { code: "weak_password", status: 422 },
      "SIGNUP",
      "weak_password",
      "A senha não atende aos requisitos de segurança.",
    ],
    [
      { name: "AuthRetryableFetchError", message: "Failed to fetch" },
      "LOGIN",
      "network",
      "Não foi possível conectar ao serviço de autenticação.",
    ],
    [
      { name: "AuthUnknownError", message: "Internal Server Error" },
      "SIGNUP",
      "unexpected",
      "Não foi possível concluir agora. Tente novamente.",
    ],
  ] as const)(
    "maps %# without exposing backend details",
    (error, operation, kind, userMessage) => {
      const result = classifyAuthError(error, operation);
      expect(result.kind).toBe(kind);
      expect(result.userMessage).toBe(userMessage);
      expect(result.userMessage).not.toContain("Internal Server Error");
    },
  );
});
