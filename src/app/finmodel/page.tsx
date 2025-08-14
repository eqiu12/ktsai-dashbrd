"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MonthSpec = {
  key: string;
  label: string;
};

type MonthRow = {
  endUsers: number; // Юзеров к концу месяца
  retention2: number; // Ретеншн 2
  mau: number; // MAU
  conversion: number; // Конверсия
  bookings: number; // Бронирований
  commissionRub: number; // Комиссия со ср. брони за месяц (с ростом)
  revenueBookings: number; // Выручка по бронированиям
  paidSubsCount: number; // Процент платных подп. от MAU 2 (число)
  revenueSubs: number; // Выручка от подписок
  totalRevenue: number; // Общая выручка (брони + подп)
  cpa: number; // Цена нового юзера (с учетом роста или по формуле для июля)
  marketingSpend: number; // На маркетинг (80%)
  newPaidUsers: number; // Новых платных юзеров
  newOrganic: number; // Новая органика
};

const MONTHS: MonthSpec[] = [
  { key: "2025-07", label: "июль 2025" },
  { key: "2025-08", label: "август 2025" },
  { key: "2025-09", label: "сентябрь" },
  { key: "2025-10", label: "октябрь" },
  { key: "2025-11", label: "ноябрь" },
  { key: "2025-12", label: "декабрь" },
  { key: "2026-01", label: "январь 2026" },
  { key: "2026-02", label: "февраль" },
  { key: "2026-03", label: "март" },
  { key: "2026-04", label: "апрель" },
  { key: "2026-05", label: "май" },
  { key: "2026-06", label: "июнь" },
  { key: "2026-07", label: "июль" },
  { key: "2026-08", label: "август" },
  { key: "2026-09", label: "сентябрь 2026" },
  { key: "2026-10", label: "октябрь 2026" },
  { key: "2026-11", label: "ноябрь 2026" },
  { key: "2026-12", label: "декабрь 2026" },
];

// Static datapoints used in table logic
const MARKETING_SHARE_TABLE = 0.8; // На маркетинг (80%) в таблице
const CPA_MONTHLY_GROWTH_DEFAULT = 1.5; // % per month

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function formatCurrency(n: number): string {
  const s = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    n
  );
  return `${s} ₽`;
}

function NumberCell({ value, onChange, min = 0, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
      min={min}
      step={step}
      style={{ width: 80, padding: 4, border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff", fontSize: 12, height: 24 }}
    />
  );
}

export default function FinModelPage() {
  // Editable seeds
  const [seedMAU, setSeedMAU] = useState<number>(11354); // first month (июль 2025)
  const [seedRetention2, setSeedRetention2] = useState<number>(5646); // first month (июль 2025)

  // Editable datapoints (top block)
  const [commissionPerBookingRub, setCommissionPerBookingRub] = useState<number>(580);
  const [targetConversionPct, setTargetConversionPct] = useState<number>(3);
  const [retentionPct, setRetentionPct] = useState<number>(30);
  const [cpaStartRub, setCpaStartRub] = useState<number>(60);
  const [cpaMonthlyGrowthPct, setCpaMonthlyGrowthPct] = useState<number>(CPA_MONTHLY_GROWTH_DEFAULT);
  const [marketingShareTopPct, setMarketingShareTopPct] = useState<number>(85);
  const [paidSubsPct, setPaidSubsPct] = useState<number>(1.5);
  const [subsRevenueRub, setSubsRevenueRub] = useState<number>(269);
  const [defaultNewOrganic, setDefaultNewOrganic] = useState<number>(2500);

  // Per-month overrides
  const [conversionOverrides, setConversionOverrides] = useState<Record<string, number>>({});
  const [bookingsOverrides, setBookingsOverrides] = useState<Record<string, number>>({});
  const [organicOverrides, setOrganicOverrides] = useState<Record<string, number>>({});
  const [paidSubsOverrides, setPaidSubsOverrides] = useState<Record<string, number>>({});
  const [marketingOverrides, setMarketingOverrides] = useState<Record<string, number>>({});
  const [newPaidOverrides, setNewPaidOverrides] = useState<Record<string, number>>({});
  const [julyCommissionRub, setJulyCommissionRub] = useState<number | null>(null);

  // Seed July 2025 (0 month) values from API and hardcoded defaults
  useEffect(() => {
    let cancelled = false;
    async function loadJuly() {
      try {
        const res = await fetch("/api/travelpayouts/aggregates?groupBy=month", { cache: "no-store" });
        const json = await res.json();
        const july = (json.rows as Array<any>).find((r) => r.key === "2025-07");
        if (!cancelled && july) {
          const paid = Number(july.paid || 0);
          const processing = Number(july.processing || 0);
          const total = Number(july.total_profit_rub || 0);
          const denom = paid + processing;
          if (denom > 0) setJulyCommissionRub(total / denom);
          setBookingsOverrides((s) => ({ ...s, ["2025-07"]: denom }));
        }
      } catch {
        // ignore fetch errors in local mode
      }
      // Hardcoded overrides
      setPaidSubsOverrides((s) => ({ ...s, ["2025-07"]: 0 }));
      setOrganicOverrides((s) => ({ ...s, ["2025-07"]: 5538 }));
      setMarketingOverrides((s) => ({ ...s, ["2025-07"]: 18000 }));
      setNewPaidOverrides((s) => ({ ...s, ["2025-07"]: 170 }));
    }
    loadJuly();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: MonthRow[] = useMemo(() => {
    const result: MonthRow[] = [];
    for (let i = 0; i < MONTHS.length; i += 1) {
      const key = MONTHS[i]!.key;
      const targetConv = targetConversionPct / 100;
      const retention = retentionPct / 100;
      const conversion = conversionOverrides[key] ?? targetConv;
      let cpa = cpaStartRub * Math.pow(1 + cpaMonthlyGrowthPct / 100, i);
      const commissionRub = i === 0 && julyCommissionRub != null ? julyCommissionRub : commissionPerBookingRub * Math.pow(1 + 0.015, i);

      const prev = result[i - 1];
      const prevEndUsers = prev?.endUsers ?? 0;
      const prevNewPaid = prev?.newPaidUsers ?? 0;
      const prevNewOrganic = prev?.newOrganic ?? 0;

      // Provisional values to break circular dependency for bookings/subs/newPaid
      const provisionalEndUsers = i === 0 ? 31719 : Math.round(prevEndUsers + prevNewPaid + prevNewOrganic);
      const provisionalRetention2 = i === 0 ? Math.round(seedRetention2) : Math.round(provisionalEndUsers * retention);
      const mauProvisional = i === 0 ? seedMAU : Math.round(provisionalRetention2 + prevNewPaid + prevNewOrganic);

      const defaultBookings = Math.round(mauProvisional * conversion);
      const bookings = bookingsOverrides[key] ?? defaultBookings;

      const revenueBookings = bookings * commissionRub;
      const paidSubsDefault = Math.round(mauProvisional * (paidSubsPct / 100));
      const paidSubsCount = Math.round(paidSubsOverrides[key] ?? paidSubsDefault);
      const revenueSubs = paidSubsCount * subsRevenueRub;
      const totalRevenue = revenueBookings + revenueSubs;
      const marketingDefault = Math.round(totalRevenue * MARKETING_SHARE_TABLE);
      const marketingSpend = Math.round(marketingOverrides[key] ?? marketingDefault);
      const newPaidUsers = Math.round(newPaidOverrides[key] ?? Math.max(0, Math.floor(marketingSpend / cpa)));
      // For July (i === 0), if overrides present, derive CPA from marketing / new paid users
      if (i === 0 && newPaidUsers > 0) {
        cpa = marketingSpend / newPaidUsers;
      }
      const newOrganicBase = key === "2025-07" ? 5538 : defaultNewOrganic;
      const newOrganic = Math.max(0, Math.round(organicOverrides[key] ?? newOrganicBase));

      // Final end users per spec: prev month endUsers + current new paid + current new organic
      const endUsers = i === 0 ? 31719 : Math.round(prevEndUsers + newPaidUsers + newOrganic);
      const retention2 = i === 0 ? Math.round(seedRetention2) : Math.round(endUsers * retention);
      const mau = i === 0 ? seedMAU : Math.round(retention2 + prevNewPaid + prevNewOrganic);

      result[i] = {
        endUsers,
        retention2,
        mau,
        conversion,
        bookings,
        commissionRub,
        revenueBookings,
        paidSubsCount,
        revenueSubs,
        totalRevenue,
        cpa,
        marketingSpend,
        newPaidUsers,
        newOrganic,
      } as MonthRow;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    seedMAU,
    seedRetention2,
    conversionOverrides,
    bookingsOverrides,
    organicOverrides,
    paidSubsOverrides,
    newPaidOverrides,
    marketingOverrides,
    julyCommissionRub,
    targetConversionPct,
    retentionPct,
    cpaStartRub,
    cpaMonthlyGrowthPct,
    commissionPerBookingRub,
    paidSubsPct,
    subsRevenueRub,
    defaultNewOrganic,
  ]);

  // Sum of "Общая выручка" for September 2025 through August 2026 (skip August 2025)
  const periodRevenueSum = useMemo(() => rows.slice(1, 13).reduce((acc, r) => acc + r.totalRevenue, 0), [rows]);
  const periodMarketingSum = useMemo(() => rows.slice(0, 12).reduce((acc, r) => acc + r.marketingSpend, 0), [rows]);
  const leftover = periodRevenueSum - periodMarketingSum;

  return (
    <div style={{ padding: 12, fontSize: 12, lineHeight: 1.2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Link href="/" style={{ padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" }}>
          ← На главную
        </Link>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Финансовая модель</h1>
      </div>

      {/* Top datapoints (editable) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(340px, 1fr))", gap: 6, marginBottom: 12 }}>
        <TopRow bg="#fce7f3" label="Комиссия со ср. брони (рост 1,5% мес)">
          <InlineCurrency value={commissionPerBookingRub} onChange={setCommissionPerBookingRub} />
        </TopRow>
        <TopRow bg="#fce7f3" label="Целевая конверсия (с сент)">
          <InlinePercent value={targetConversionPct} onChange={setTargetConversionPct} />
        </TopRow>
        <TopRow bg="#fce7f3" label="Ретеншн">
          <InlinePercent value={retentionPct} onChange={setRetentionPct} />
        </TopRow>
        <TopRow bg="#fef9c3" label="Цена нового юзера (рост 1,5% мес)">
          <InlineCurrency value={cpaStartRub} onChange={setCpaStartRub} />
        </TopRow>
        <TopRow bg="#eaf4ff" label="Рост цены нового юзера в мес">
          <InlinePercent value={cpaMonthlyGrowthPct} onChange={setCpaMonthlyGrowthPct} />
        </TopRow>
        <TopRow bg="#e8f5e9" label="Выручка за сентябрь 25-август 26" readonly>
          <strong>{formatCurrency(periodRevenueSum)}</strong>
        </TopRow>
        <TopRow bg="#e8f5e9" label="Траты на маркетинг от выручки">
          <InlinePercent value={marketingShareTopPct} onChange={setMarketingShareTopPct} />
        </TopRow>
        <TopRow bg="#e8f5e9" label="Маркетинг июль 25-июнь 26" readonly>
          <strong>{formatCurrency(periodMarketingSum)}</strong>
        </TopRow>
        <TopRow bg="#dcfce7" label="Остаток на прочие расходы и прибыль" readonly>
          <strong>{formatCurrency(leftover)}</strong>
        </TopRow>
        <TopRow bg="#e0f2fe" label="Процент платных подп. от MAU">
          <InlinePercent value={paidSubsPct} onChange={setPaidSubsPct} />
        </TopRow>
        <TopRow bg="#e0f2fe" label="Выручка от 1 подписки">
          <InlineCurrency value={subsRevenueRub} onChange={setSubsRevenueRub} />
        </TopRow>
        <TopRow bg="#eef2ff" label="Новая органика (по умолчанию)">
          <NumberCell value={defaultNewOrganic} onChange={(v) => setDefaultNewOrganic(Math.max(0, Math.round(v)))} step={100} />
        </TopRow>
      </div>

      

      {/* Transposed table: metrics as rows, months as columns */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12, lineHeight: 1.1 }}>
          <thead>
            <tr>
              <Th>Метрика</Th>
              {MONTHS.map((m) => (
                <Th key={m.key}>{m.label}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Юзеров к концу месяца */}
            <tr>
              <Td><strong>Юзеров к концу месяца</strong></Td>
              {MONTHS.map((m, i) => (
                <Td key={m.key}>{formatNumber(rows[i]!.endUsers)}</Td>
              ))}
            </tr>
            {/* Ретеншн 2 */}
            <tr>
              <Td><strong>Ретеншн 2</strong></Td>
              {MONTHS.map((m, i) => (
                <Td key={m.key}>
                  {i === 0 ? (
                    <NumberCell value={rows[i]!.retention2} onChange={(v) => setSeedRetention2(Math.max(0, Math.round(v)))} />
                  ) : (
                    formatNumber(rows[i]!.retention2)
                  )}
                </Td>
              ))}
            </tr>
            {/* MAU */}
            <tr>
              <Td><strong>MAU</strong></Td>
              {MONTHS.map((m, i) => (
                <Td key={m.key}>
                  {i === 0 ? (
                    <NumberCell value={rows[i]!.mau} onChange={(v) => setSeedMAU(Math.max(0, Math.round(v)))} />
                  ) : (
                    formatNumber(rows[i]!.mau)
                  )}
                </Td>
              ))}
            </tr>
            {/* Конверсия */}
            <tr>
              <Td><strong>Конверсия</strong></Td>
              {MONTHS.map((m, i) => {
                const key = m.key;
                if (i === 0) {
                  const r0 = rows[0]!;
                  const pct = (r0.mau > 0 ? (r0.bookings / r0.mau) * 100 : 0).toFixed(2);
                  return (
                    <Td key={m.key}>
                      <span>{pct}%</span>
                    </Td>
                  );
                }
                const value = Math.round((conversionOverrides[key] ?? targetConversionPct / 100) * 1000) / 10;
                return (
                  <Td key={m.key}>
                    <NumberCell
                      value={value}
                      onChange={(v) => setConversionOverrides((s) => ({ ...s, [key]: Math.max(0, Math.min(1, v / 100)) }))}
                      step={0.1}
                    />
                    <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 4 }}>%</span>
                  </Td>
                );
              })}
            </tr>
            {/* Бронирований */}
            <tr>
              <Td><strong>Бронирований</strong></Td>
              {MONTHS.map((m, i) => {
                const key = m.key;
                const r = rows[i]!;
                return (
                  <Td key={m.key}>
                    <NumberCell
                      value={bookingsOverrides[key] ?? r.bookings}
                      onChange={(v) => setBookingsOverrides((s) => ({ ...s, [key]: Math.max(0, Math.round(v)) }))}
                    />
                  </Td>
                );
              })}
            </tr>
            {/* Комиссия со ср. брони */}
            <tr>
              <Td><strong>Комиссия со ср. брони</strong></Td>
              {MONTHS.map((m, i) => (
                <Td key={m.key}>{formatCurrency(rows[i]!.commissionRub)}</Td>
              ))}
            </tr>
            {/* Выручка */}
            <tr>
              <Td><strong>Выручка</strong></Td>
              {MONTHS.map((m, i) => (
                <Td key={m.key}>{formatCurrency(rows[i]!.revenueBookings)}</Td>
              ))}
            </tr>
            {/* Платные подписки (шт.) */}
            <tr>
              <Td><strong>Платные подписки (шт.)</strong></Td>
              {MONTHS.map((m, i) => {
                const key = m.key;
                const r = rows[i]!;
                return (
                  <Td key={m.key}>
                    <NumberCell
                      value={paidSubsOverrides[key] ?? r.paidSubsCount}
                      onChange={(v) => setPaidSubsOverrides((s) => ({ ...s, [key]: Math.max(0, Math.round(v)) }))}
                      step={1}
                    />
                  </Td>
                );
              })}
            </tr>
            {/* Выручка подписок */}
            <tr>
              <Td><strong>Выручка подписок</strong></Td>
              {MONTHS.map((m, i) => (
                <Td key={m.key}>{formatCurrency(rows[i]!.revenueSubs)}</Td>
              ))}
            </tr>
            {/* Общая выручка */}
            <tr>
              <Td><strong>Общая выручка</strong></Td>
              {MONTHS.map((m, i) => (
                <Td key={m.key}><strong>{formatCurrency(rows[i]!.totalRevenue)}</strong></Td>
              ))}
            </tr>
            {/* Цена нового юзера */}
            <tr>
              <Td><strong>Цена нового юзера</strong></Td>
              {MONTHS.map((m, i) => (
                <Td key={m.key}>{formatCurrency(rows[i]!.cpa)}</Td>
              ))}
            </tr>
            {/* На маркетинг (80%) */}
            <tr>
              <Td><strong>На маркетинг (80%)</strong></Td>
              {MONTHS.map((m, i) => {
                const key = m.key;
                const r = rows[i]!;
                return (
                  <Td key={m.key}>
                    <NumberCell
                      value={marketingOverrides[key] ?? r.marketingSpend}
                      onChange={(v) => setMarketingOverrides((s) => ({ ...s, [key]: Math.max(0, Math.round(v)) }))}
                      step={100}
                    />
                  </Td>
                );
              })}
            </tr>
            {/* Новых платных юзеров */}
            <tr>
              <Td><strong>Новых платных юзеров</strong></Td>
              {MONTHS.map((m, i) => (
                <Td key={m.key}>{formatNumber(rows[i]!.newPaidUsers)}</Td>
              ))}
            </tr>
            {/* Новая органика */}
            <tr>
              <Td><strong>Новая органика</strong></Td>
              {MONTHS.map((m, i) => {
                const key = m.key;
                const r = rows[i]!;
                return (
                  <Td key={m.key}>
                    <NumberCell
                      value={organicOverrides[key] ?? r.newOrganic}
                      onChange={(v) => setOrganicOverrides((s) => ({ ...s, [key]: Math.max(0, Math.round(v)) }))}
                    />
                  </Td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        position: "sticky",
        top: 0,
        background: "#f9fafb",
        textAlign: "left",
        fontWeight: 600,
        padding: 4,
        borderBottom: "1px solid #e5e7eb",
        whiteSpace: "normal",
        fontSize: 12,
        lineHeight: 1.1,
        maxWidth: 140,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: 4, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", height: 22 }}>
      {children}
    </td>
  );
}

function Card({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 12,
        background: highlight ? "#f0fdf4" : "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function TopRow({ label, children, bg, readonly = false }: { label: string; children: React.ReactNode; bg?: string; readonly?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center" }}>
      <div style={{ padding: 6, background: bg ?? "#f9fafb", border: "1px solid #e5e7eb", borderRight: "none", borderRadius: "6px 0 0 6px", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ padding: 6, background: bg ?? "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "0 6px 6px 0", minWidth: 120, textAlign: "right" }}>
        {children}
        {!readonly && null}
      </div>
    </div>
  );
}

function InlineCurrency({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span>
      <input
        type="number"
        value={Number.isFinite(value) ? value.toFixed(2) : "0.00"}
        onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
        style={{ width: 90, padding: 4, border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff", textAlign: "right", fontSize: 12, height: 24 }}
      />
      <span style={{ marginLeft: 6 }}>₽</span>
    </span>
  );
}

function InlinePercent({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span>
      <input
        type="number"
        value={Number.isFinite(value) ? value.toFixed(2) : "0.00"}
        onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
        style={{ width: 70, padding: 4, border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff", textAlign: "right", fontSize: 12, height: 24 }}
        step={0.1}
      />
      <span style={{ marginLeft: 6 }}>%</span>
    </span>
  );
}


