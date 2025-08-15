import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { roQueryAll } from "@/lib/sql";

type Group = "date" | "month" | "program";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupBy = (searchParams.get("groupBy") as Group) || "date";
  const accountId = process.env.TRAVEPLY_RO_ACCOUNT_ID || "tp_2d51005457cd7a1e";

  let sql: string;
  if (groupBy === "date") {
    sql = `
      SELECT 
        substr(COALESCE(booked_at, updated_at), 1, 10) as key,
        COUNT(DISTINCT action_id) AS actions,
        SUM(CASE WHEN lower(action_state) = 'paid' THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN lower(action_state) = 'processing' THEN 1 ELSE 0 END) AS processing,
        SUM(CASE WHEN lower(action_state) IN ('cancelled','canceled') THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN lower(action_state) = 'paid' THEN CAST(COALESCE(paid_profit_rub, profit_rub) AS REAL) ELSE 0 END) AS paid_profit_rub,
        SUM(CASE WHEN lower(action_state) = 'processing' THEN CAST(COALESCE(processing_profit_rub, profit_rub) AS REAL) ELSE 0 END) AS pending_profit_rub,
        (
          SUM(CASE WHEN lower(action_state) = 'paid' THEN CAST(COALESCE(paid_profit_rub, profit_rub) AS REAL) ELSE 0 END) +
          SUM(CASE WHEN lower(action_state) = 'processing' THEN CAST(COALESCE(processing_profit_rub, profit_rub) AS REAL) ELSE 0 END)
        ) AS total_profit_rub,
        CASE WHEN (
            SUM(CASE WHEN lower(action_state) = 'paid' THEN 1 ELSE 0 END) +
            SUM(CASE WHEN lower(action_state) = 'processing' THEN 1 ELSE 0 END)
          ) > 0
          THEN (
            (
              SUM(CASE WHEN lower(action_state) = 'paid' THEN CAST(COALESCE(paid_profit_rub, profit_rub) AS REAL) ELSE 0 END) +
              SUM(CASE WHEN lower(action_state) = 'processing' THEN CAST(COALESCE(processing_profit_rub, profit_rub) AS REAL) ELSE 0 END)
            ) * 1.0
          ) /
          (
            SUM(CASE WHEN lower(action_state) = 'paid' THEN 1 ELSE 0 END) +
            SUM(CASE WHEN lower(action_state) = 'processing' THEN 1 ELSE 0 END)
          )
          ELSE 0 END AS avg_profit_per_booking_rub
      FROM travelpayouts_actions
      WHERE account_id = ?
      GROUP BY key
      ORDER BY key DESC
      LIMIT 365;
    `;
  } else if (groupBy === "month") {
    sql = `
      SELECT 
        substr(COALESCE(booked_at, updated_at), 1, 7) as key,
        COUNT(DISTINCT action_id) AS actions,
        SUM(CASE WHEN lower(action_state) = 'paid' THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN lower(action_state) = 'processing' THEN 1 ELSE 0 END) AS processing,
        SUM(CASE WHEN lower(action_state) IN ('cancelled','canceled') THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN lower(action_state) = 'paid' THEN CAST(COALESCE(paid_profit_rub, profit_rub) AS REAL) ELSE 0 END) AS paid_profit_rub,
        SUM(CASE WHEN lower(action_state) = 'processing' THEN CAST(COALESCE(processing_profit_rub, profit_rub) AS REAL) ELSE 0 END) AS pending_profit_rub,
        (
          SUM(CASE WHEN lower(action_state) = 'paid' THEN CAST(COALESCE(paid_profit_rub, profit_rub) AS REAL) ELSE 0 END) +
          SUM(CASE WHEN lower(action_state) = 'processing' THEN CAST(COALESCE(processing_profit_rub, profit_rub) AS REAL) ELSE 0 END)
        ) AS total_profit_rub,
        CASE WHEN (
            SUM(CASE WHEN lower(action_state) = 'paid' THEN 1 ELSE 0 END) +
            SUM(CASE WHEN lower(action_state) = 'processing' THEN 1 ELSE 0 END)
          ) > 0
          THEN (
            (
              SUM(CASE WHEN lower(action_state) = 'paid' THEN CAST(COALESCE(paid_profit_rub, profit_rub) AS REAL) ELSE 0 END) +
              SUM(CASE WHEN lower(action_state) = 'processing' THEN CAST(COALESCE(processing_profit_rub, profit_rub) AS REAL) ELSE 0 END)
            ) * 1.0
          ) /
          (
            SUM(CASE WHEN lower(action_state) = 'paid' THEN 1 ELSE 0 END) +
            SUM(CASE WHEN lower(action_state) = 'processing' THEN 1 ELSE 0 END)
          )
          ELSE 0 END AS avg_profit_per_booking_rub
      FROM travelpayouts_actions
      WHERE account_id = ?
      GROUP BY key
      ORDER BY key DESC
      LIMIT 48;
    `;
  } else {
    // program/group by campaignId
    sql = `
      SELECT 
        CAST(campaign_id AS TEXT) as key,
        COUNT(DISTINCT action_id) AS actions,
        SUM(CASE WHEN lower(action_state) = 'paid' THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN lower(action_state) = 'processing' THEN 1 ELSE 0 END) AS processing,
        SUM(CASE WHEN lower(action_state) IN ('cancelled','canceled') THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN lower(action_state) = 'paid' THEN CAST(COALESCE(paid_profit_rub, profit_rub) AS REAL) ELSE 0 END) AS paid_profit_rub,
        SUM(CASE WHEN lower(action_state) = 'processing' THEN CAST(COALESCE(processing_profit_rub, profit_rub) AS REAL) ELSE 0 END) AS pending_profit_rub,
        (
          SUM(CASE WHEN lower(action_state) = 'paid' THEN CAST(COALESCE(paid_profit_rub, profit_rub) AS REAL) ELSE 0 END) +
          SUM(CASE WHEN lower(action_state) = 'processing' THEN CAST(COALESCE(processing_profit_rub, profit_rub) AS REAL) ELSE 0 END)
        ) AS total_profit_rub,
        CASE WHEN (
            SUM(CASE WHEN lower(action_state) = 'paid' THEN 1 ELSE 0 END) +
            SUM(CASE WHEN lower(action_state) = 'processing' THEN 1 ELSE 0 END)
          ) > 0
          THEN (
            (
              SUM(CASE WHEN lower(action_state) = 'paid' THEN CAST(COALESCE(paid_profit_rub, profit_rub) AS REAL) ELSE 0 END) +
              SUM(CASE WHEN lower(action_state) = 'processing' THEN CAST(COALESCE(processing_profit_rub, profit_rub) AS REAL) ELSE 0 END)
            ) * 1.0
          ) /
          (
            SUM(CASE WHEN lower(action_state) = 'paid' THEN 1 ELSE 0 END) +
            SUM(CASE WHEN lower(action_state) = 'processing' THEN 1 ELSE 0 END)
          )
          ELSE 0 END AS avg_profit_per_booking_rub
      FROM travelpayouts_actions
      WHERE account_id = ?
      GROUP BY key
      ORDER BY total_profit_rub DESC
      LIMIT 100;
    `;
  }

  const rows = await roQueryAll<any>(sql, [accountId]);
  return NextResponse.json({ groupBy, rows });
}


