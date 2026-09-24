import { getClickUpConfig, getLatestEvent } from "@/lib/clickup";
export function GET() { return Response.json({ ...getClickUpConfig(), latestEvent: getLatestEvent() }); }