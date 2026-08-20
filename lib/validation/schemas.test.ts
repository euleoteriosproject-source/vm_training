import { describe, expect, it } from "vitest";
import { measurementSchema, signUpSchema } from "./schemas";
describe("validation", () => {
  it("normalizes email and accepts matching strong passwords", () =>
    expect(
      signUpSchema.parse({
        email: " User@Example.COM ",
        password: "12345678",
        confirmPassword: "12345678",
      }).email,
    ).toBe("user@example.com"));
  it("rejects mismatched passwords", () =>
    expect(
      signUpSchema.safeParse({
        email: "a@b.com",
        password: "12345678",
        confirmPassword: "abcdefgh",
      }).success,
    ).toBe(false));
  it("rejects impossible body weight", () =>
    expect(
      measurementSchema.safeParse({
        measuredAt: new Date().toISOString(),
        weightKg: 5,
      }).success,
    ).toBe(false));
});
