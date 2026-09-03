import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesForm } from "./preferences-form";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));

const preferences = {
  sessions_per_week: 3,
  session_minutes: 60,
  cardio_preference: 3,
  gym_profile: "STANDARD_COMMERCIAL_GYM",
  workout_style: "gym_first" as const,
};

describe("PreferencesForm v2.1.5", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: {}, error: null });
  });

  it("shows goal, frequency, duration and cardio without an equipment inventory", () => {
    render(<PreferencesForm preferences={preferences} goal="general_health" />);
    expect(screen.getByRole("heading", { name: "Objetivo" })).toBeVisible();
    expect(screen.getByText("Academia comercial padrão")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^Academia \/ máquinas\./ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Preferência por cardio")).toHaveValue("3");
    expect(screen.queryByText("Equipamentos disponíveis")).not.toBeInTheDocument();
    expect(screen.queryByText("Hack squat")).not.toBeInTheDocument();
  });

  it("persists goal, sessions, duration and cardio without touching equipment rows", async () => {
    render(<PreferencesForm preferences={preferences} goal="general_health" />);
    fireEvent.click(screen.getByRole("button", { name: /^Força\./ }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "75" }));
    fireEvent.change(screen.getByLabelText("Preferência por cardio"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith("save_training_preferences_v215", {
      p_goal_code: "strength",
      p_sessions_per_week: 4,
      p_session_minutes: 75,
      p_cardio_preference: 4,
      p_gym_profile: "STANDARD_COMMERCIAL_GYM",
      p_workout_style: "gym_first",
    });
    expect(screen.getByText("Seu treino atual continua ativo.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Atualizar meu treino" })).toBeVisible();
  });

  it("offers a new-plan preview after saving unchanged preferences", async () => {
    render(<PreferencesForm preferences={preferences} goal="general_health" />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
    expect(screen.getByText("Seu treino atual continua ativo.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Atualizar meu treino" })).toBeVisible();
  });

  it("creates a preview and activates only after explicit confirmation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            preview: {
              id: "21100000-0000-0000-0000-000000000001",
              goal: "strength",
              daysPerWeek: 3,
              sessionMinutes: 60,
              structure: "Full Body A / Full Body B / Full Body C",
              exercisesPerDay: [6, 6, 6],
              changes: ["mais foco em força"],
              gymEquipmentSlots: 16,
              gymEquipmentPercent: 88.9,
              machineCableSlots: 12,
              freeWeightSlots: 4,
              bodyweightFloorSlots: 2,
              bodyweightPercent: 11.1,
            },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PreferencesForm preferences={preferences} goal="general_health" />);
    fireEvent.click(screen.getByRole("button", { name: /^Força\./ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));
    await screen.findByText("Seu treino atual continua ativo.");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar meu treino" }));
    expect(await screen.findByText("Prévia do novo plano")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar e ativar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/plans/21100000-0000-0000-0000-000000000001/activate",
      { method: "POST" },
    );
    expect(mocks.push).toHaveBeenCalledWith("/workouts");
  });
});
