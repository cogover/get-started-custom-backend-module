import assert from "node:assert/strict";

// Deliberately local-only: no credentials or real response bodies in test output.
try {
  const leadId = process.env.COGOVER_TEST_LEAD_ID?.trim();
  if (!leadId) throw new Error("Set COGOVER_TEST_LEAD_ID to an accessible Lead ID.");
  const url = new URL(process.env.COGOVER_TEST_URL ?? "http://127.0.0.1:3100/api/v1/ts-projects/get_lead");
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password) {
    throw new Error("COGOVER_TEST_URL must be a credential-free http://127.0.0.1 URL.");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leadId }),
    signal: AbortSignal.timeout(30000),
  });
  if (response.status !== 200) throw new Error("Local API did not return HTTP 200; inspect it privately.");
  const result = await response.json();
  // Do not use assertion messages that could print real records or IDs.
  assert.ok(result?.lead?.id === leadId, "Returned Lead ID does not match.");
  for (const field of ["name", "first_name", "last_name", "status", "emails"]) {
    assert.ok(Object.hasOwn(result.lead.fields ?? {}, field), "A selected Lead field is missing.");
  }
  const invalid = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: "{}", signal: AbortSignal.timeout(30000),
  });
  assert.ok(invalid.status === 400, "Invalid input must return HTTP 400.");
  console.log("PASS: live Lead read, selected fields, and input validation. No record contents logged.");
} catch {
  console.error("FAIL: live smoke test. Check the local URL, Lead ID, running Development Session and permissions privately.");
  process.exitCode = 1;
}
