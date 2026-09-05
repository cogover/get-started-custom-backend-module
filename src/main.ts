import { createRouter } from "@cogover/sdk";
import { getLeadHandler } from "./lead-script.js";

const router = createRouter();
router.post("/", getLeadHandler);

export default router.toHandler();
