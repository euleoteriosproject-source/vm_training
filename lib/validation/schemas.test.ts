import { describe, expect, it } from "vitest";
import { measurementSchema, signUpSchema } from "./schemas";
describe("validation", () => {
  it("normalizes email and accepts matching strong passwords", () =>
    expect(
      signUpSchema.parse({
        email: " User@Example.COM ",
        password: "TreinoSeguro12",
        confirmPassword: "TreinoSeguro12",
      }).email,
    ).toBe("user@example.com"));
  it("rejects mismatched passwords", () =>
    expect(
      signUpSchema.safeParse({
        email: "a@b.com",
        password: "TreinoSeguro12",
        confirmPassword: "OutraSenha34",
      }).success,
    ).toBe(false));
  it("enforces the hosted signup password policy", () => {
    for (const password of [
      "Curta1",
      "semsenhaforte12",
      "SEMMINUSCULA12",
      "SemNumeroAlgum",
    ]) {
      expect(
        signUpSchema.safeParse({
          email: "a@b.com",
          password,
          confirmPassword: password,
        }).success,
      ).toBe(false);
    }
  });
  it("rejects impossible body weight", () =>
    expect(
      measurementSchema.safeParse({
        measuredAt: new Date().toISOString(),
        weightKg: 5,
      }).success,
    ).toBe(false));
});
