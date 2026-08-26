import { describe, expect, it } from "vitest";
import { planSwapErrorMessage, planSwapRequestSchema } from "./plan-swap";

describe("plan swap contract", () => {
  it("accepts strict replacement and rebalance preview requests", () => {
    expect(
      planSwapRequestSchema.safeParse({
        action: "replace",
        replacementExerciseId: "11111111-1111-4111-8111-111111111111",
        persistExclusion: true,
      }).success,
    ).toBe(true);
    expect(
      planSwapRequestSchema.safeParse({
        action: "preview-rebalance",
        desiredExerciseId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed identifiers", () => {
    expect(
      planSwapRequestSchema.safeParse({
        action: "replace",
        replacementExerciseId: "not-an-id",
      }).success,
    ).toBe(false);
  });

  it("maps semantic and quality failures without leaking database details", () => {
    expect(
      planSwapErrorMessage("Esse exercício tem uma função diferente no treino"),
    ).toBe("Esse exercício tem uma função diferente no treino.");
    expect(
      planSwapErrorMessage("Plano v2.1.2 falhou nos gates de diversidade"),
    ).toBe(
      "A alteração não preservaria a qualidade do plano e não foi aplicada.",
    );
    expect(planSwapErrorMessage("internal relation foo failed")).toBe(
      "Não foi possível alterar o treino agora. Nenhuma mudança foi aplicada.",
    );
  });
});
