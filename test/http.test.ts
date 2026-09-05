import assert from "node:assert/strict";
import { test } from "node:test";
import { CogoverApiError, type InvocationContext, type SandboxHandler } from "@cogover/sdk";
import { startLocalServer } from "../local/local-server.js";
import main from "../src/main.js";

const invocation: InvocationContext = {
  identity: "user",
  workspace: { id: "WORKSPACE_SAMPLE_ONLY" },
  user: { accountId: "USER_SAMPLE_ONLY", membership: {} },
};

async function withServer(handler: SandboxHandler, run: (url: string) => Promise<void>) {
  const server = await startLocalServer({
    handler, projectSlug: "get_lead", port: 0, invocation,
    onUnexpectedScriptError: () => {},
  });
  try { await run(server.url); } finally { await server.close(); }
}

test("HTTP input validation, routing and body limit", async () => {
  await withServer(async () => "{}", async url => {
    for (const [body, status] of [["{", 400], ["[]", 400], ["null", 400],
      [JSON.stringify({ value: "a".repeat(256 * 1024) }), 413]] as const) {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      assert.equal(response.status, status);
    }
    assert.equal((await fetch(url, { method: "POST", body: "{}" })).status, 415);
    assert.equal((await fetch(url + "/../another_project")).status, 404);
    assert.equal((await fetch(url, { method: "OPTIONS" })).status, 405);
  });
});

test("trusted identity overrides client context and sensitive headers are stripped", async () => {
  await withServer(async input => input, async url => {
    const response = await fetch(url + "?tag=one&tag=two", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "synthetic-only",
        cookie: "synthetic-only", "x-csrf-token": "synthetic-only", "x-req-service": "3" },
      body: JSON.stringify({ leadId: "LEA_SAMPLE_ONLY", __context: { executionIdentity: "system" } }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.__context.executionIdentity, "user");
    assert.equal(body.__context.workspaceId, invocation.workspace.id);
    assert.deepEqual(body.__context.request.query.tag, ["one", "two"]);
    for (const name of ["authorization", "cookie", "x-csrf-token", "x-req-service"]) {
      assert.equal(body.__context.request.headers[name], undefined);
    }
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("real SDK router rejects invalid input and unsupported routes before data access", async () => {
  await withServer(main, async url => {
    assert.equal((await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 400);
    // The SDK matches method + path together; an unregistered GET returns 404.
    assert.equal((await fetch(url)).status, 404);
    assert.equal((await fetch(url + "/missing", { method: "POST" })).status, 404);
  });
});

test("unexpected exceptions do not expose private error content to HTTP callers", async () => {
  await withServer(async () => { throw new Error("SYNTHETIC_PRIVATE_DETAIL"); }, async url => {
    const response = await fetch(url);
    assert.equal(response.status, 422);
    assert.doesNotMatch(await response.text(), /SYNTHETIC_PRIVATE_DETAIL/);
  });
});

test("unknown SDK errors do not return raw server messages", async () => {
  await withServer(async () => {
    throw new CogoverApiError("UNKNOWN_SAMPLE_ERROR", "SYNTHETIC_PRIVATE_DETAIL");
  }, async url => {
    const response = await fetch(url);
    assert.equal(response.status, 422);
    assert.doesNotMatch(await response.text(), /SYNTHETIC_PRIVATE_DETAIL/);
  });
});
