import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function request(origin: string, body: unknown) {
  return new NextRequest("http://192.168.2.109:3000/api/auth/diagnostics", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "192.168.2.109:3000",
      origin,
    },
    body: JSON.stringify(body),
  });
}

const safeDiagnostic = {
  operation: "LOGIN",
  code: "network_error",
  status: 0,
  errorClass: "AuthRetryableFetchError",
  route: "/login",
  requestId: "0198d9e2-9f0c-7000-a000-000000000001",
};

describe("auth diagnostics route", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts and logs only the validated sanitized envelope", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(
      request("http://192.168.2.109:3000", safeDiagnostic),
    );

    expect(response.status).toBe(204);
    expect(log).toHaveBeenCalledWith("AUTH_UNEXPECTED_ERROR", {
      ...safeDiagnostic,
      host: "192.168.2.109:3000",
      origin: "http://192.168.2.109:3000",
    });
  });

  it("rejects a cross-origin report without logging it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(
      request("http://attacker.invalid", safeDiagnostic),
    );

    expect(response.status).toBe(403);
    expect(log).not.toHaveBeenCalled();
  });

  it("rejects unstructured values that could leak into logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(
      request("http://192.168.2.109:3000", {
        ...safeDiagnostic,
        code: "raw error containing spaces and user data",
      }),
    );

    expect(response.status).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });
});
