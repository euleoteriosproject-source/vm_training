import { cloneElement, type ReactElement, type ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanExerciseSwap } from "./plan-exercise-swap";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/components/video/viewport-video", () => ({
  ViewportVideo: () => <div data-testid="candidate-media" />,
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    trigger,
    children,
    onOpenChange,
  }: {
    trigger: ReactNode;
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div>
      {cloneElement(trigger as ReactElement<{ onClick?: () => void }>, {
        onClick: () => onOpenChange(true),
      })}
      {children}
    </div>
  ),
}));

const equivalent = {
  exerciseId: "11111111-1111-4111-8111-111111111111",
  exerciseName: "Supino com barra",
  movementPattern: "horizontal_push",
  trainingRole: "horizontal_push",
  category: "strength",
  difficulty: "beginner",
  primaryMuscles: ["peitoral"],
  secondaryMuscles: ["tríceps"],
  equipmentNames: ["Barra"],
  mediaUrl: "/demo.gif",
  posterUrl: "/poster.webp",
  mediaType: "gif" as const,
  isEquivalent: true,
  reason: "Mesmo padrão de empurrar horizontal",
  totalCount: 1,
};

describe("PlanExerciseSwap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows ranked equivalent details and asks for confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [equivalent] }),
      }),
    );
    render(<PlanExerciseSwap slotId="slot-1" exerciseName="Supino no chão" />);
    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
    expect(await screen.findByText("Supino com barra")).toBeInTheDocument();
    expect(
      screen.getByText("Mesmo padrão de empurrar horizontal"),
    ).toBeInTheDocument();
    expect(screen.getByText("Barra")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Trocar" })[1]);
    expect(
      screen.getByText("Confirmar troca equivalente?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Não quero este exercício nos meus treinos futuros/),
    ).toBeInTheDocument();
  });

  it("labels a non-equivalent choice and requires a rebalance preview", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              ...equivalent,
              isEquivalent: false,
              reason: "Função diferente no treino",
            },
          ],
        }),
      }),
    );
    render(
      <PlanExerciseSwap slotId="slot-2" exerciseName="Superman bilateral" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Quero este exercício" }),
    );
    expect(
      screen.getByText("Esse exercício tem uma função diferente no treino."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reorganizar treino" }),
    ).toBeInTheDocument();
  });

  it("uses the same-origin replacement route and redirects to the versioned day", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [equivalent] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          eventId: "event-1",
          planId: "plan-2",
          dayId: "day-2",
          exerciseName: "Supino com barra",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<PlanExerciseSwap slotId="slot-3" exerciseName="Supino no chão" />);
    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
    await screen.findByText("Supino com barra");
    fireEvent.click(screen.getAllByRole("button", { name: "Trocar" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar troca" }));

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/workouts/day-2"),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/plans/exercises/slot-3/swap",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Exercício alterado",
      expect.objectContaining({ duration: 9000 }),
    );
  });
});
