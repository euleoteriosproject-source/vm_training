import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AuthForm } from "./auth-form";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  loginAction: vi.fn(),
  signupAction: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));
vi.mock("@/app/auth-actions", () => ({
  loginAction: mocks.loginAction,
  signupAction: mocks.signupAction,
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

  it("prevents native credential submission before hydration", () => {
    const markup = renderToString(<AuthForm mode="login" />);
    expect(markup).toContain('method="post"');
    const submitButton = markup.match(/<button[^>]*>/)?.[0];
    expect(submitButton).toContain('type="submit"');
    expect(submitButton).toContain('disabled=""');
  });

  it("uses the same-origin login action and redirects after success", async () => {
    mocks.loginAction.mockResolvedValue({ ok: true, redirectTo: "/today" });
    render(<AuthForm mode="login" />);
    submitLogin();

    await waitFor(() => expect(mocks.loginAction).toHaveBeenCalledOnce());
    expect(mocks.loginAction).toHaveBeenCalledWith({
      email: "member@example.test",
      password: "DiagnosticSafe12",
      next: null,
    });
    expect(mocks.replace).toHaveBeenCalledWith("/today");
  });

  it("uses the same-origin signup action and redirects to onboarding", async () => {
    mocks.signupAction.mockResolvedValue({
      ok: true,
      redirectTo: "/onboarding",
    });
    render(<AuthForm mode="signup" />);
    submitSignup();

    await waitFor(() => expect(mocks.signupAction).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/onboarding");
  });

  it("shows invalid credentials returned by the server action", async () => {
    mocks.loginAction.mockResolvedValue({
      ok: false,
      failure: {
        kind: "invalid_credentials",
        userMessage: "E-mail ou senha incorretos.",
        code: "invalid_credentials",
        status: 400,
        errorClass: "AuthApiError",
        reportable: false,
      },
    });
    render(<AuthForm mode="login" />);
    submitLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha incorretos.",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("shows the existing-account guidance instead of a network error", async () => {
    mocks.signupAction.mockResolvedValue({
      ok: false,
      failure: {
        kind: "existing_user",
        userMessage: "Este e-mail já possui uma conta. Entre com sua senha.",
        code: "user_already_exists",
        status: 422,
        errorClass: "AuthFlowError",
        reportable: false,
      },
    });
    render(<AuthForm mode="signup" />);
    submitSignup();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este e-mail já possui uma conta. Entre com sua senha.",
    );
  });
});
