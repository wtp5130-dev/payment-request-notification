export type ClickUpEvent = { taskName: string; taskId: string; previousStatus: string; currentStatus: string; receivedAt: string };
let latestEvent: ClickUpEvent | null = null;
export function saveEvent(event: ClickUpEvent) { latestEvent = event; }
export function getLatestEvent() { return latestEvent; }
export function getClickUpConfig() { return { listId: process.env.CLICKUP_LIST_ID || "901816752697", validateStatusId: process.env.CLICKUP_VALIDATE_STATUS_ID || "sc901816752697_xMTGXVI", configured: Boolean(process.env.CLICKUP_API_TOKEN), webhookReady: Boolean(process.env.CLICKUP_WEBHOOK_SECRET) }; }