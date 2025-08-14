import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { roQueryAll } from "@/lib/sql";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const parsed = limitParam ? Number(limitParam) : 100;
  const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(500, Math.trunc(parsed))) : 100;
  const offsetParsed = offsetParam ? Number(offsetParam) : 0;
  const offset = Number.isFinite(offsetParsed) ? Math.max(0, Math.trunc(offsetParsed)) : 0;
  const accountId = process.env.TRAVEPLY_RO_ACCOUNT_ID || "tp_2d51005457cd7a1e";
  const actions = await roQueryAll<any>(
    `SELECT action_id, action_state, price_rub,
            paid_profit_rub, processing_profit_rub, COALESCE(paid_profit_rub, profit_rub) AS profit_rub,
            description, booked_at, updated_at
     FROM travelpayouts_actions
     WHERE account_id = ?
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    [accountId, limit, offset]
  );

  return NextResponse.json({
    balance: null,
    nextPayout: null,
    actions: actions.map((a: any) => ({
      actionId: a.action_id,
      actionState: a.action_state,
      price: String(a.price_rub),
      profit: String(a.paid_profit_rub ?? a.profit_rub),
      processingProfit: a.processing_profit_rub != null ? String(a.processing_profit_rub) : undefined,
      description: a.description ?? undefined,
      bookedAt: a.booked_at ?? undefined,
      updatedAtRemote: a.updated_at ?? undefined,
    })),
    daily: [],
    payments: [],
  });
}


