import { NextResponse, type NextRequest } from "next/server";

const safeToken = /^[a-zA-Z0-9_.:-]{1,80}$/;
const safeRequestId = /^[a-f0-9-]{16,64}$/;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    if (!origin || !host || new URL(origin).host !== host)
      return new NextResponse(null, { status: 403 });
  } catch {
    return new NextResponse(null, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const value = body as Record<string, unknown>;
  const operation = value.operation;
  const route = value.route;
  const code = value.code;
  const status = value.status;
  const errorClass = value.errorClass;
  const requestId = value.requestId;
  if (
    !["LOGIN", "SIGNUP"].includes(String(operation)) ||
    !["/login", "/sign-up"].includes(String(route)) ||
    !safeToken.test(String(code)) ||
    !safeToken.test(String(errorClass)) ||
    !safeRequestId.test(String(requestId)) ||
    !(
      status === null ||
      (typeof status === "number" && status >= 0 && status <= 599)
    )
  )
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  console.error("AUTH_UNEXPECTED_ERROR", {
    operation,
    code,
    status,
    errorClass,
    route,
    requestId,
    host,
    origin,
  });
  return new NextResponse(null, { status: 204 });
}
