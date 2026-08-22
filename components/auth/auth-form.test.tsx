import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
    push: mocks.push,
  }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
    },
  }),
}));

function submitLogin() {
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "member@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Senha", { exact: true }), {
    target: { value: "DiagnosticSafe12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

function submitSignup() {
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "new-member@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Senha", { exact: true }), {
    target: { value: "DiagnosticSafe12" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), {
    target: { value: "DiagnosticSafe12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
}

describe("AuthForm", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
  });

  it("reaches signInWithPassword and redirects after a persisted session", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "test-session" } },
      error: null,
    });
    render(<AuthForm mode="login" />);
    submitLogin();

    await waitFor(() =>
      expect(mocks.signInWithPassword).toHaveBeenCalledOnce(),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/today");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("reaches signUp and redirects an immediate session to onboarding", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        session: { access_token: "test-session" },
        user: { identities: [{ id: "identity" }] },
      },
      error: null,
    });
    render(<AuthForm mode="signup" />);
    submitSignup();

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/onboarding");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("maps invalid credentials without swallowing the client redirect flow", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: "invalid_credentials", status: 400 },
    });
    render(<AuthForm mode="login" />);
    submitLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha incorretos.",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
