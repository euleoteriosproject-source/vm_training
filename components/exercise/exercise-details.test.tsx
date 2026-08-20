import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExerciseDetails } from "./exercise-details";

describe("ExerciseDetails", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });
  it("opens the execution dialog from the explicit trigger", () => {
    render(
      <ExerciseDetails
        exercise={{
          name: "Leg press",
          primaryMuscles: ["quadríceps"],
          secondaryMuscles: [],
          instructions: ["Controle o movimento"],
          breathing: null,
          errors: [],
          mediaType: "gif",
          mediaUrl: "https://example.test/demo.gif",
          posterUrl: "https://example.test/poster.webp",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Execução" }));
    expect(screen.getByRole("dialog", { name: "Como fazer" })).toBeVisible();
  });
});
