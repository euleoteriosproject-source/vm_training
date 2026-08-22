import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn<
    (...args: [string, string, unknown]) => { auth: Record<string, never> }
  >(() => ({ auth: {} })),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));
vi.mock("./env", () => ({
  getSupabaseEnv: () => ({
    url: "https://inghftngeritrsezwxnm.supabase.co",
    key: "sb_publishable_test-only",
  }),
  SUPABASE_AUTH_COOKIE: "vm-training-auth",
}));

import { createClient } from "./client";

describe("browser Supabase client", () => {
  beforeEach(() => createBrowserClient.mockClear());

  it("uses Hosted Auth directly on localhost and LAN while preserving cookies", () => {
    createClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://inghftngeritrsezwxnm.supabase.co",
      "sb_publishable_test-only",
      { cookieOptions: { name: "vm-training-auth" } },
    );
    expect(createBrowserClient.mock.calls[0]?.[0]).not.toContain("/supabase");
  });
});
