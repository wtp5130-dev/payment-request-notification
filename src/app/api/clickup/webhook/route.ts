import { createHmac, timingSafeEqual } from "node:crypto";
import { getClickUpConfig, saveEvent } from "@/lib/clickup";

function hasValidSignature(body: string, signature: string | null) {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}

export async function POST(request: Request) {
  const body = await request.text();

  if (!hasValidSignature(body, request.headers.get("x-signature")))
    return Response.json({ error: "Invalid signature" }, { status: 401 });

  const payload = JSON.parse(body) as Record<string, unknown>;
  const historyItems = Array.isArray(payload.history_items)
    ? payload.history_items
    : [];
  const history = (historyItems[0] || {}) as Record<string, unknown>;

  // ClickUp sends before/after as status objects directly on the history item.
  // history.field is the string "status", NOT an object with .after/.before.
  const afterStatus = (history.after || {}) as Record<string, unknown>;
  const beforeStatus = (history.before || {}) as Record<string, unknown>;

  const config = getClickUpConfig();

  // list_id lives at the top level of the webhook payload
  const listId = String(payload.list_id || "");
  const isTargetList = listId === config.listId;

  // Match on the after-status name (case-insensitive)
  const afterStatusName = String(afterStatus.status || "").toLowerCase();
  const isValidate = afterStatusName === "validate";

  if (!isTargetList || !isValidate)
    return Response.json({
      accepted: false,
      reason: "Event does not match the Validate watch",
    });

  const taskId = String(payload.task_id || "unknown");
  let taskName = `Task ${taskId}`;

  // Optionally enrich with the task name from ClickUp API
  const token = process.env.CLICKUP_API_TOKEN;
  if (token) {
    try {
      const res = await fetch(
        `https://api.clickup.com/api/v2/task/${taskId}`,
        { headers: { Authorization: token } }
      );
      if (res.ok) {
        const taskData = (await res.json()) as Record<string, unknown>;
        taskName = String(taskData.name || taskName);
      }
    } catch {
      // fall through with default name
    }
  }

  saveEvent({
    taskName,
    taskId,
    previousStatus: String(beforeStatus.status || "unknown"),
    currentStatus: "Validate",
    receivedAt: new Date().toISOString(),
  });

  return Response.json({ accepted: true });
}
