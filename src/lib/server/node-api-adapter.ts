import { Readable, Writable } from "node:stream";

type HeaderValue = string | number | readonly string[];
type BackendResponse = Writable & {
  setHeader(name: string, value: HeaderValue): BackendResponse;
  writeHead(
    status: number,
    headers?: Record<string, HeaderValue>,
  ): BackendResponse;
};

const handleBackendRequest = require("../../backend") as (
  request: Readable & Record<string, unknown>,
  response: BackendResponse,
) => Promise<void>;

/** Adapts a Next.js Request to the shared Node backend used by both hosts. */
export async function backendResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const bytes =
    request.method === "GET" || request.method === "HEAD"
      ? Buffer.alloc(0)
      : Buffer.from(await request.arrayBuffer());
  const source = Readable.from(bytes.length ? [bytes] : []) as Readable &
    Record<string, unknown>;
  source.method = request.method;
  source.url = url.pathname + url.search;
  source.headers = Object.fromEntries(request.headers);
  source.socket = {
    remoteAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1",
    encrypted: url.protocol === "https:",
  };

  let status = 200;
  const headers = new Headers();
  const chunks: Buffer[] = [];
  const target = new Writable({
    write(chunk: Buffer, _encoding, done) {
      chunks.push(Buffer.from(chunk));
      done();
    },
  }) as BackendResponse;
  target.setHeader = (name, value) => {
    headers.delete(name);
    if (Array.isArray(value))
      value.forEach((item) => headers.append(name, String(item)));
    else headers.set(name, String(value));
    return target;
  };
  target.writeHead = (code, values = {}) => {
    status = code;
    for (const [name, value] of Object.entries(values))
      target.setHeader(name, value);
    return target;
  };
  const finished = new Promise<void>((resolve, reject) => {
    target.once("finish", resolve);
    target.once("error", reject);
  });
  try {
    await handleBackendRequest(source, target);
    await finished;
  } catch {
    return Response.json(
      { error: "The request could not be completed." },
      { status: 503 },
    );
  }
  return new Response(Buffer.concat(chunks), { status, headers });
}
