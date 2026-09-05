import {
  NotFoundError,
  ValidationError,
  type CogoverRecord,
  type ScriptHandler,
  type WorkspaceObjects,
} from "@cogover/sdk";

type LeadFields = WorkspaceObjects["lead"];
interface GetLeadInput { leadId: string; }
interface GetLeadOutput { lead: CogoverRecord<LeadFields>; }

const READ_FIELDS = ["name", "first_name", "last_name", "status", "emails"] as const;

function requireLeadId(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError("leadId is required");
  }
  return value.trim();
}

// Uses the current caller's permissions; it never elevates to a system identity.
export const getLeadHandler: ScriptHandler<GetLeadInput, GetLeadOutput> =
  async ({ input, data, log }) => {
    const leadId = requireLeadId(input?.leadId);
    const lead = await data.object("lead").records.get(leadId, { fields: READ_FIELDS });
    if (!lead) throw new NotFoundError("lead", leadId);
    // Do not put lead IDs, names, email addresses, or credentials in shared logs.
    log.info("Lead loaded");
    return { lead };
  };
