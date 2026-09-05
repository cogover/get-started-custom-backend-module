import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundError, ValidationError } from "@cogover/sdk";
import { getLeadHandler } from "../src/lead-script.js";

const lead = {
  id: "LEA_SAMPLE_ONLY",
  fields: { name: "Sample Lead", first_name: "Sample", last_name: "Lead", status: null, emails: null },
  system: {},
};

function fixture(input: unknown, record: unknown = lead) {
  const calls: unknown[] = [];
  const logs: unknown[] = [];
  const context = {
    input,
    data: { object: (slug: string) => {
      calls.push(slug);
      return { records: { get: async (...args: unknown[]) => { calls.push(args); return record; } } };
    } },
    log: { info: (...args: unknown[]) => logs.push(args) },
  } as unknown as Parameters<typeof getLeadHandler>[0];
  return { context, calls, logs };
}

test("reads only the documented fields as the current caller and trims the ID", async () => {
  const f = fixture({ leadId: "  LEA_SAMPLE_ONLY  " });
  assert.deepEqual(await getLeadHandler(f.context), { lead });
  assert.deepEqual(f.calls, ["lead", ["LEA_SAMPLE_ONLY", {
    fields: ["name", "first_name", "last_name", "status", "emails"],
  }]]);
  assert.deepEqual(f.logs, [["Lead loaded"]]);
});

for (const input of [undefined, null, {}, { leadId: "" }, { leadId: "   " }, { leadId: 1 }, { leadId: [] }]) {
  test("rejects invalid input before reading data: " + JSON.stringify(input), async () => {
    const f = fixture(input);
    await assert.rejects(async () => getLeadHandler(f.context), ValidationError);
    assert.deepEqual(f.calls, []);
  });
}

test("missing record produces NotFoundError and no success log", async () => {
  const f = fixture({ leadId: "LEA_SAMPLE_ONLY" }, null);
  await assert.rejects(async () => getLeadHandler(f.context), NotFoundError);
  assert.deepEqual(f.logs, []);
});

test("data access errors are not swallowed", async () => {
  const f = fixture({ leadId: "LEA_SAMPLE_ONLY" });
  const denied = new Error("synthetic access denied");
  f.context.data.object = () => { throw denied; };
  await assert.rejects(async () => getLeadHandler(f.context), error => error === denied);
});
