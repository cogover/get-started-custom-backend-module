# Get Started: Custom Backend Module

[English](README.md) | [Tiếng Việt](README.vi.md)

A complete TypeScript sample that accepts a `leadId`, reads one Cogover Lead as
the current caller, and returns `{ lead }`. The same `src/main.ts` runs locally
and in Cogover. No credentials or real workspace/Lead data are included.

## Requirements

- Node.js 20+ and npm (Node.js 22.12+ recommended for both sample projects).
- A Cogover workspace with an Object slug `lead`, and an existing Lead to read.
- A Custom Backend Module Project, normally with slug `get_lead`.
- Project policy and caller permissions allowing read access to `lead` and
  `name`, `first_name`, `last_name`, `status`, `emails`.
- A **Project key** for local development.
- A separate **Workspace API key** for CLI publish, activation, and session generation.

The workspace schema must match `src/workspace.d.ts`; declaring a type does not
create an Object or grant permissions. Ask your administrator for the Project ID,
Project key, schema, and an accessible Lead ID. This sample never creates Leads.

## 1. Install and check without credentials

Download/clone this repository, then open its directory containing `package.json`:

```bash
npm ci
npm run check
npm install --global @cogover/dev-cli
cogover-dev --version
```

`npm run check` type-checks source, runner and tests, then runs credential-free
unit and HTTP integration tests. These use synthetic data and do not prove
access to your workspace. The CLI install command uses the latest version
published to npm.

## 2. Configure your Project

In Cogover's **Custom Backend Module** UI, create a Project if necessary:
name `Get lead`, slug `get_lead`. Keep the Project ID (`TSP...`) and actual slug.
If you already have a Project, use it; the CLI does not create Projects.

```bash
cp cogover.example.json cogover.json
```

Edit the ignored `cogover.json`:

```json
{
  "version": 1,
  "runtimeUrl": "https://example.cogover.com",
  "projectId": "TSPXXXXXXXXXXXX",
  "projectSlug": "get_lead",
  "projectType": "backend"
}
```

Replace the example origin and ID with your values. `runtimeUrl` is the full
HTTPS workspace origin, with no API path. Use your actual Project slug.
Do not put either key in this file.

## 3. Authenticate and run the local API

From this Project directory, log in at the hidden **Project key** prompt:

```bash
cogover-dev login --profile get_lead
cogover-dev doctor --profile get_lead
COGOVER_LOCAL_PORT=3100 cogover-dev run --profile get_lead -- npm run dev
```

Use the same profile name for login, doctor and run. The command above uses
POSIX shell syntax; in PowerShell, set `$env:COGOVER_LOCAL_PORT = "3100"` first,
then run the `cogover-dev run ...` portion.

The local server binds only to `127.0.0.1`. Keep it running and use another
terminal for curl. File changes restart the server after type-checking.
Do not start with bare `npm run dev`: the SDK needs the Development Session
injected by `cogover-dev run`. The session uses the caller associated with the
Project key, not an arbitrary user.

Replace `LEAD_ID` with an existing Lead ID that caller can read:

```bash
curl --fail-with-body -X POST 'http://127.0.0.1:3100/api/v1/ts-projects/get_lead' \
  -H 'Content-Type: application/json' \
  --data '{"leadId":"LEAD_ID"}'
```

Use your actual slug in the URL. A successful local response is `{ "lead": ... }`.
The record contains `id`, `fields` and `system`; system metadata and field values
depend on your workspace. Invalid/blank input returns HTTP 400. The SDK router
returns 404 for an unregistered method/path (including GET on this POST route).

You can also run the live smoke test while the local server is running:

```bash
COGOVER_TEST_LEAD_ID=LEAD_ID npm run test:live
```

For a different port/slug, additionally set `COGOVER_TEST_URL` to the full local
endpoint. This read-only test validates the returned ID and five fields, and
prints only pass/fail, not record contents.

## 4. Publish and activate

`npm run build` is a type-check only: it does not emit JavaScript or a ZIP.
Only `src/` is deployed. Never upload the whole repository or `local/`.

### Option A: CLI

```bash
npm run check
cogover-dev publish
```

The CLI ZIPs `src/`, uploads the ZIP as private, creates a version, and waits for
`READY` or `FAILED`. Its temporary ZIP is removed afterward. A ZIP explicitly
supplied as `cogover-dev publish get-lead.zip` is used as-is and is not deleted.

Publish and activation use the **Workspace API key**, not the Project key.
The CLI checks `COGOVER_API_KEY` in the Project `.env` first, then native
credential storage; otherwise it prompts with hidden input. For non-interactive
Docker/CI, securely provision the private `.env` beforehand, outside upload
artifacts. Never paste secrets into command-line arguments.

When ready, run the activation command printed by publish:

```bash
cogover-dev activate VERSION_ID
```

Replace `VERSION_ID` with the returned **TSV... version ID**, not the TSP...
Project ID. Activation changes the workspace's active version. Do not activate a
failed version; fix the reported issue and publish a new one.

### Option B: UI

From the repository root (requires the `zip` utility):

```bash
npm run check
zip -r get-lead.zip src -x '*/.*' '__MACOSX/*'
```

Use a new ZIP filename (or remove your old generated ZIP first) to avoid stale
entries from an earlier archive. The exclusions omit hidden/macOS metadata files.
The archive must contain `src/main.ts`, `src/lead-script.ts` and
`src/workspace.d.ts`. Open the Project in Custom Backend Module, create a
version, upload this ZIP as a private file, wait for `READY`, and activate it.

## 5. Test the deployed version as a production caller

In this directory, generate a private curl config using your **Workspace API key**:

```bash
cogover-dev auth session --format curl --output .cogover-session.curl
```

This obtains a **real Web App session**, containing the three cookies
`HttpSessionId`, `XSRF-TOKEN`, `AuthToken` and the matching `x-csrf-token` and
`x-xsrf-token` headers. It exercises the production invocation flow, not local
development or Preview. It does not select an arbitrary end-user or elevate
permissions: the identity is the one Cogover assigns to the Workspace API key.
To verify a specific person's access, use that person's valid session instead.

Replace the example domain, slug if necessary, and Lead ID below. Send this
session only to the workspace for which it was generated; do not add `-L`
to forward session headers through redirects.

```bash
curl --fail-with-body --config .cogover-session.curl \
  -X POST 'https://example.cogover.com/api/v1/ts-projects/get_lead' \
  -H 'Content-Type: application/json' \
  -H 'x-req-type: 6' \
  -H 'x-req-service: 3' \
  --data '{"leadId":"LEAD_ID"}'
```

The production response wraps the result in `body`, so inspect `body.lead`,
not just the HTTP status. It also includes protocol metadata such as `service`,
`serviceVersion`, `type` and `id`. Local success alone does not prove that the
production session has the same permissions.

## Security and troubleshooting

- `src/`: deployed business code; `local/`: loopback-only development adapter;
  `test/`: synthetic tests, never deployed.
- Keys, session/cookie files, real config, ZIPs and logs are ignored by Git.
  Ignoring a file does not protect one already tracked: review `git status`
  and `git diff --cached` before publishing.
- No Lead IDs or field values are logged by the handler. Unexpected runner errors
  use generic diagnostics; inspect sensitive failures privately with a debugger.
- Native credential storage is preferred. Where unavailable, CLI login falls
  back to a private `.env` and updates `.gitignore`. Protect that file.
- Delete generated session files when finished; regenerate if expired. Never
  share terminal captures containing API responses, headers or credentials.
- 401: check the correct credential type and workspace; restart an invalidated
  Development Session. 403: check Project policy, Project key and caller permissions.
- Unknown field: compare your Object schema with `workspace.d.ts` and
  `READ_FIELDS`. A TypeScript declaration alone cannot fix a server schema.
- Port in use: choose another `COGOVER_LOCAL_PORT` and update the curl URL.
- Backend dependencies that are only used by the runner must stay outside
  `src/`; code deployed to Cogover must use supported runtime APIs.

Licensed under MIT; see [LICENSE](LICENSE).
