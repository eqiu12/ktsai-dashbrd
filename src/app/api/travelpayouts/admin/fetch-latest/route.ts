import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { fetchActions, fetchActionDetails } from "@/lib/travelpayouts";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 10), 300);

    const actions = await fetchActions({ limit });

    const enriched = await Promise.all(
      actions.map(async (a) => {
        let description: string | undefined = a.description;
        if (!description || description.trim() === "") {
          try {
            const details = await fetchActionDetails(a.action_id, "rub");
            description = details?.description ?? description;
          } catch {}
        }
        return {
          action_id: a.action_id,
          campaign_id: a.campaign_id,
          action_state: a.action_state,
          currency: "rub",
          price: a.price,
          profit: a.profit,
          description: description ?? "",
          booked_at: a.booked_at ?? null,
          updated_at: a.updated_at ?? null,
        };
      })
    );

    return NextResponse.json({ count: enriched.length, actions: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown" }, { status: 500 });
  }
}




