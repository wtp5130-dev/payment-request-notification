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

/** Extract status name from multiple possible payload shapes */
function extractStatus(payload: Record<string, unknown>): {
  current: string;
  previous: string;
} {
  // Shape 1: API webhook — history_items[].before / .after are status objects
  const historyItems = Array.isArray(payload.history_items)
    ? payload.history_items
    : [];
  const history = (historyItems[0] || {}) as Record<string, unknown>;
  const afterObj = history.after as Record<string, unknown> | undefined;
  const beforeObj = history.before as Record<string, unknown> | undefined;

  if (afterObj && typeof afterObj === "object" && afterObj.status) {
    return {
      current: String(afterObj.status),
      previous: String(beforeObj?.status || "unknown"),
    };
  }

  // Shape 2: Automation webhook — task object has .status.status
  const task = (payload.task || payload) as Record<string, unknown>;
  const taskStatus = task.status as Record<string, unknown> | undefined;
  if (taskStatus && typeof taskStatus === "object" && taskStatus.status) {
    return {
      current: String(taskStatus.status),
      previous: String(beforeObj?.status || history.before || "unknown"),
    };
  }

  // Shape 3: flat status string on the payload
  if (typeof payload.status === "string") {
    return { current: payload.status, previous: "unknown" };
  }

  return { current: "", previous: "unknown" };
}

/** Extract list ID from multiple possible payload shapes */
function extractListId(payload: Record<string, unknown>): string {
  if (payload.list_id) return String(payload.list_id);
  const task = payload.task as Record<string, unknown> | undefined;
  if (task) {
    const list = task.list as Record<string, unknown> | undefined;
    if (list?.id) return String(list.id);
  }
  return "";
}

/** Extract task name and ID from multiple possible payload shapes */
function extractTask(payload: Record<string, unknown>): {
  id: string;
  name: string;
} {
  const task = payload.task as Record<string, unknown> | undefined;
  return {
    id: String(payload.task_id || task?.id || "unknown"),
    name: String(task?.name || payload.task_name || ""),
  };
}

export async function POST(request: Request) {
  const body = await request.text();

  if (!hasValidSignature(body, request.headers.get("x-signature")))
    return Response.json({ error: "Invalid signature" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const config = getClickUpConfig();
  const listId = extractListId(payload);
  const isTargetList = listId === config.listId;
  const { current, previous } = extractStatus(payload);
  const isValidate = current.toLowerCase() === "validate";

  if (!isTargetList || !isValidate)
    return Response.json({
      accepted: false,
      reason: "Event does not match the Validate watch",
      debug: { listId, currentStatus: current, isTargetList, isValidate },
    });

  const { id: taskId, name: taskNameFromPayload } = extractTask(payload);
  let taskName = taskNameFromPayload || `Task ${taskId}`;

  // Optionally enrich with the task name from ClickUp API if not in payload
  if (!taskNameFromPayload) {
    const token = process.env.CLICKUP_API_TOKEN;
    if (token && taskId !== "unknown") {
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
  }

  saveEvent({
    taskName,
    taskId,
    previousStatus: previous,
    currentStatus: "Validate",
    receivedAt: new Date().toISOString(),
  });

  return Response.json({ accepted: true });
}
