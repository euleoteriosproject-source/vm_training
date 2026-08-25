import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction, signupAction } from "./auth-actions";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
    },
  })),
}));

const password = "DiagnosticSafe12";

describe("server-side auth actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("logs in through the server client and accepts only safe local redirects", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "not-returned-to-browser" } },
      error: null,
    });

    await expect(
      loginAction({
        email: " MEMBER@example.test ",
        password,
        next: "https://attacker.example",
      }),
    ).resolves.toEqual({ ok: true, redirectTo: "/today" });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "member@example.test",
      password,
    });
  });

  it("signs up through the server client without exposing a session", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        session: { access_token: "not-returned-to-browser" },
        user: { identities: [{ id: "identity" }] },
      },
      error: null,
    });

    await expect(
      signupAction({
        email: "new-member@example.test",
        password,
        confirmPassword: password,
      }),
    ).resolves.toEqual({ ok: true, redirectTo: "/onboarding" });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "new-member@example.test",
      password,
    });
  });

  it("maps an existing account to the explicit login guidance", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: { identities: [] } },
      error: null,
    });

    const result = await signupAction({
      email: "existing@example.test",
      password,
      confirmPassword: password,
    });
    expect(result).toMatchObject({
      ok: false,
      failure: {
        kind: "existing_user",
        userMessage: "Este e-mail já possui uma conta. Entre com sua senha.",
      },
    });
  });

  it("maps allowlist rejection without reporting it as connectivity", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { name: "AuthApiError", status: 403, code: "hook_rejected" },
    });

    const result = await signupAction({
      email: "blocked@example.test",
      password,
      confirmPassword: password,
    });
    expect(result).toMatchObject({
      ok: false,
      failure: {
        kind: "allowlist_denied",
        userMessage: "Este e-mail não está autorizado para cadastro.",
      },
    });
  });
});
