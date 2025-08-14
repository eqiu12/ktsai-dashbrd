import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { ensureSchema } from "@/lib/schemaInit";
import { execute } from "@/lib/sql";
import { fetchActions, fetchActionDetails } from "@/lib/travelpayouts";

const normalizeKey = (id: string, campaignId?: number) => {
  return /^\d+:/.test(id) ? id : (campaignId != null ? `${campaignId}:${id}` : id);
};

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 10), 300);

    const actions = await fetchActions({ limit });
    let inserted = 0;

    for (const a of actions) {
      const key = normalizeKey(a.action_id, a.campaign_id);
      let description: string | undefined = a.description;
      if (!description || description.trim() === "") {
        try {
          const details = await fetchActionDetails(a.action_id, "rub");
          description = details?.description ?? description;
        } catch {}
      }
      await execute(
        `INSERT INTO "TravelpayoutsAction" (
           actionId, campaignId, actionState, currency, price, profit, paidProfit, processingProfit, description, bookedAt, updatedAtRemote
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(actionId) DO UPDATE SET
           actionState=excluded.actionState,
           currency=excluded.currency,
           price=CASE WHEN excluded.price IS NOT NULL AND excluded.price != '' THEN excluded.price ELSE price END,
           profit=CASE WHEN excluded.profit IS NOT NULL AND excluded.profit != '' THEN excluded.profit ELSE profit END,
           paidProfit=COALESCE(excluded.paidProfit, paidProfit),
           processingProfit=COALESCE(excluded.processingProfit, processingProfit),
           description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE description END,
           bookedAt=COALESCE(excluded.bookedAt, bookedAt),
           updatedAtRemote=COALESCE(excluded.updatedAtRemote, updatedAtRemote)
        `,
        [
          key,
          a.campaign_id,
          a.action_state,
          "rub",
          a.price ?? "0",
          a.profit ?? "0",
          null,
          null,
          description ?? "",
          a.booked_at ?? null,
          a.updated_at ?? null,
        ]
      );
      inserted += 1;
    }

    return NextResponse.json({ ok: true, inserted });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}




