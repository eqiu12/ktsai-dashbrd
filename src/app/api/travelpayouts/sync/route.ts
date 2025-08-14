import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { execute, queryAll } from "@/lib/sql";
import { fetchActions, fetchBalance, fetchNextPayout, fetchPayments, fetchStatisticsActionsRaw } from "@/lib/travelpayouts";
import { ensureSchema } from "@/lib/schemaInit";

// Acquire Prisma lazily inside the handler so we can run schema init first

export async function GET(req: Request) {
  try {
    await ensureSchema();
    // Optional reset of cached actions/statistics
    const url = new URL(req.url);
    const reset = url.searchParams.get("reset");
    if (reset === "1" || reset === "true") {
      await execute(`DELETE FROM "TravelpayoutsAction"`);
      await execute(`DELETE FROM "DailyStatistic"`);
    }

    const [balance, nextPayout] = await Promise.all([fetchBalance(), fetchNextPayout()]);
    await execute(`INSERT INTO "BalanceSnapshot" (usd, eur, rub) VALUES (?, ?, ?)`, [balance.usd, balance.eur, balance.rub]);
    await execute(`INSERT INTO "NextPayoutSnapshot" (usd, eur, rub) VALUES (?, ?, ?)`, [nextPayout.usd, nextPayout.eur, nextPayout.rub]);

    // Page through finance actions and statistics raw to ensure all states are covered
    const actions: any[] = [];
    const pageSize = 300;
    for (let offset = 0; offset < 2000; offset += pageSize) {
      const batch = await fetchActions({ limit: pageSize, offset });
      if (!batch.length) break;
      actions.push(...batch);
      if (batch.length < pageSize) break;
    }
    const statsRaw: any[] = [];
    for (let offset = 0; offset < 2000; offset += 500) {
      const batch = await fetchStatisticsActionsRaw({ limit: 500, offset });
      if (!batch.length) break;
      statsRaw.push(...batch);
      if (batch.length < 500) break;
    }
    const payments = await fetchPayments({ currency: "rub", limit: 200 });

    // Merge finance and stats raw by action_id
    const normalizeKey = (id: string, campaignId?: number) => {
      return /^\d+:/.test(id) ? id : (campaignId != null ? `${campaignId}:${id}` : id);
    };
    const map = new Map<string, any>();
    for (const a of actions) {
      const key = normalizeKey(a.action_id, a.campaign_id);
      map.set(key, { ...a, action_id: key });
    }
    for (const s of statsRaw) {
      const normId = normalizeKey(s.action_id, s.campaign_id);
      const existing = map.get(normId) ?? {};
      // Fetch description if missing
      let description = existing.description;
      if (!description) {
        try {
          const details = await fetchActionDetails(s.action_id, "rub");
          description = details?.description ?? description ?? "";
        } catch {}
      }
      map.set(normId, {
        action_id: normId,
        campaign_id: s.campaign_id ?? existing.campaign_id,
        action_state: s.state ?? existing.action_state,
        // Prefer stats amounts when finance lacks processing
        price: existing.price ?? s.price_rub ?? "0",
        profit: existing.profit ?? s.paid_profit_rub ?? (s.state?.toLowerCase() === "processing" ? s.processing_profit_rub ?? "0" : "0"),
        paid_profit: s.paid_profit_rub ?? null,
        processing_profit: s.processing_profit_rub ?? null,
        description: description ?? "",
        currency: "rub",
        booked_at: existing.booked_at ?? s.created_at,
        updated_at: existing.updated_at ?? s.updated_at,
      });
    }

    for (const a of map.values()) {
      await execute(
        `INSERT INTO "TravelpayoutsAction" (
           actionId, campaignId, actionState, currency, price, profit, paidProfit, processingProfit, description, bookedAt, updatedAtRemote
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(actionId) DO UPDATE SET
           actionState=excluded.actionState,
           currency=excluded.currency,
           price=CASE WHEN excluded.price IS NOT NULL AND excluded.price != "" THEN excluded.price ELSE price END,
           profit=CASE WHEN excluded.profit IS NOT NULL AND excluded.profit != "" THEN excluded.profit ELSE profit END,
           paidProfit=COALESCE(excluded.paidProfit, paidProfit),
           processingProfit=COALESCE(excluded.processingProfit, processingProfit),
           description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE description END,
           bookedAt=COALESCE(excluded.bookedAt, bookedAt),
           updatedAtRemote=COALESCE(excluded.updatedAtRemote, updatedAtRemote)
        `,
        [
          a.action_id,
          a.campaign_id,
          a.action_state,
          a.currency ?? null,
          a.price ?? "0",
          a.profit ?? "0",
          a.paid_profit ?? null,
          a.processing_profit ?? null,
          a.description ?? "",
          a.booked_at ?? null,
          a.updated_at ?? null,
        ]
      );
    }

    // Naive daily aggregation from actions (bookings = count of paid/confirmed, earnings = sum of profit)
    const grouped = new Map<string, { clicks: number; bookings: number; earnings: number }>();
    for (const a of actions) {
      const day = (a.booked_at ? a.booked_at : a.updated_at)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      const entry = grouped.get(day) ?? { clicks: 0, bookings: 0, earnings: 0 };
      // clicks unknown via finance API; keep 0 for now
      if (["paid", "confirmed"].includes(a.action_state.toLowerCase())) {
        entry.bookings += 1;
      }
      entry.earnings += Number(a.profit ?? 0);
      grouped.set(day, entry);
    }

    for (const [day, stats] of grouped.entries()) {
      await execute(
        `INSERT INTO "DailyStatistic" (date, clicks, bookings, earnings)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET clicks=excluded.clicks, bookings=excluded.bookings, earnings=excluded.earnings`,
        [day, stats.clicks, stats.bookings, stats.earnings]
      );
    }

    for (const p of payments) {
      await execute(
        `INSERT INTO "UserPayment" (paymentUuid, paidAt, amount, currency, paymentInfoId, comment)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(paymentUuid) DO UPDATE SET amount=excluded.amount, currency=excluded.currency, comment=excluded.comment`,
        [p.payment_uuid, p.paid_at, p.amount, p.currency, p.payment_info_id ?? null, p.comment ?? null]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}


