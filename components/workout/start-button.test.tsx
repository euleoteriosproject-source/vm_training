import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartButton } from "./start-button";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  rpc: vi.fn(),
  clearPendingMutations: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/offline/queue", () => ({
  clearPendingMutations: mocks.clearPendingMutations,
}));
vi.mock("sonner", () => ({
  toast: { info: mocks.toastInfo, error: mocks.toastError },
}));

describe("StartButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.rpc.mockResolvedValue({ data: "new-session", error: null });
    mocks.clearPendingMutations.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("clears only stale workout browser state after the server accepts discard", async () => {
    localStorage.setItem("rest:stale-session", "9999999999999");
    render(
      <StartButton dayId="current-day" discardSessionId="stale-session" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Iniciar treino" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workout-session/new-session"));
    expect(mocks.rpc).toHaveBeenCalledWith("start_workout", {
      p_workout_day_id: "current-day",
    });
    expect(localStorage.getItem("rest:stale-session")).toBeNull();
    expect(mocks.clearPendingMutations).toHaveBeenCalledOnce();
    expect(mocks.toastInfo).toHaveBeenCalledOnce();
  });

  it("preserves browser state when the server rejects the start", async () => {
    localStorage.setItem("rest:stale-session", "9999999999999");
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Treino indisponível" },
    });
    render(
      <StartButton dayId="current-day" discardSessionId="stale-session" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Iniciar treino" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(localStorage.getItem("rest:stale-session")).not.toBeNull();
    expect(mocks.clearPendingMutations).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
