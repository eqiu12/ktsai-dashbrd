type BalanceResponse = {
  balance: { usd: string; eur: string; rub: string };
};

type NextPayoutResponse = {
  next_payout: { usd: string; eur: string; rub: string };
};

type ActionsResponse = {
  actions: Array<{
    action_id: string;
    campaign_id: number;
    action_state: string;
    price: string;
    profit: string;
    description?: string;
    currency?: string;
    booked_at?: string;
    updated_at?: string;
  }>;
};

const BASE = "https://api.travelpayouts.com";

function authHeaders() {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) throw new Error("TRAVELPAYOUTS_API_TOKEN is not set");
  return { "X-Access-Token": token };
}

export async function fetchBalance(): Promise<BalanceResponse["balance"]> {
  const res = await fetch(`${BASE}/finance/v2/get_user_balance`, {
    headers: authHeaders(),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Balance HTTP ${res.status}`);
  const json = (await res.json()) as BalanceResponse;
  return json.balance;
}

export async function fetchNextPayout(): Promise<NextPayoutResponse["next_payout"]> {
  const res = await fetch(`${BASE}/finance/v2/get_user_next_payout`, {
    headers: authHeaders(),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`NextPayout HTTP ${res.status}`);
  const json = (await res.json()) as NextPayoutResponse;
  return json.next_payout;
}

export async function fetchActions(params?: { from?: string; until?: string; limit?: number; offset?: number }) {
  const url = new URL(`${BASE}/finance/v2/get_user_actions_affecting_balance`);
  url.searchParams.set("currency", "rub");
  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.until) url.searchParams.set("until", params.until);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url.toString(), {
    headers: authHeaders(),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Actions HTTP ${res.status}`);
  const json = (await res.json()) as ActionsResponse;
  return json.actions;
}

type Payment = {
  paid_at: string;
  payment_uuid: string;
  amount: string;
  currency: string;
  payment_info_id?: number;
  comment?: string;
};

export async function fetchPayments(params?: { limit?: number; offset?: number; currency?: "rub" | "usd" | "eur" }) {
  const url = new URL(`${BASE}/finance/v2/get_user_payments`);
  url.searchParams.set("currency", params?.currency ?? "rub");
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url.toString(), {
    headers: authHeaders(),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Payments HTTP ${res.status}`);
  const json = (await res.json()) as Payment[];
  return json;
}

// Statistics API (raw actions) to include processing/cancelled
export async function fetchStatisticsActionsRaw(params: { offset: number; limit: number; fromISO?: string }) {
  const url = `${BASE}/statistics/v1/execute_query`;
  const from = params.fromISO ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);
  const body = {
    fields: [
      "action_id",
      "campaign_id",
      "state",
      "price_rub",
      "paid_profit_rub",
      "processing_profit_rub",
      "created_at",
      "updated_at",
    ],
    filters: [
      { field: "type", op: "eq", value: "action" },
      { field: "date", op: "ge", value: from },
    ],
    sort: [{ field: "created_at", order: "desc" }],
    offset: params.offset,
    limit: params.limit,
  } as const;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Stats raw HTTP ${res.status}`);
  const json = (await res.json()) as { results: any[] };
  return json.results;
}

export async function fetchActionDetails(actionId: string, currency: "rub" | "usd" | "eur" = "rub") {
  const url = new URL(`${BASE}/finance/v2/get_action_details`);
  url.searchParams.set("action_id", actionId);
  url.searchParams.set("currency", currency);
  const res = await fetch(url.toString(), { headers: authHeaders(), next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Action details HTTP ${res.status}`);
  const json = (await res.json()) as any;
  return json;
}


