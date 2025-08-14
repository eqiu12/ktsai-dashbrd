"use client";
import { useMemo, useState } from "react";

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
  revenueBookings: number; // Выручка по бронированиям
  paidSubsCount: number; // Процент платных подп. от MAU 2 (число)
  revenueSubs: number; // Выручка от подписок
  totalRevenue: number; // Общая выручка (брони + подп)
  cpa: number; // Цена нового юзера (с учетом роста)
  marketingSpend: number; // На маркетинг (80%)
  newPaidUsers: number; // Новых платных юзеров
  newOrganic: number; // Новая органика
};

const MONTHS: MonthSpec[] = [
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
];

// Hardcoded datapoints
const COMMISSION_PER_BOOKING_RUB = 580; // Комиссия со ср. брони
const TARGET_CONVERSION = 0.03; // Целевая конверсия (с сент)
const RETENTION = 0.3; // Ретеншн
const CPA_START_RUB = 60; // Цена нового юзера (рост 1,5% мес)
const CPA_MONTHLY_GROWTH = 0.015; // 1.5%
const MARKETING_SHARE_TABLE = 0.8; // На маркетинг (80%) в таблице
const MARKETING_SHARE_TOP = 0.85; // Траты на маркетинг от выручки (топ блок)
const PAID_SUBS_PERCENT_OF_MAU = 0.015; // Процент платных подп. от MAU
const SUBS_REVENUE_PER_USER_RUB = 269; // Выручка от 1 подписки

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function formatCurrency(n: number): string {
  return `${formatNumber(n)} ₽`;
}

function NumberCell({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
      min={min}
      style={{ width: 120, padding: 6, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" }}
    />
  );
}

export default function FinModelPage() {
  // Editable seeds
  const [seedEndUsers, setSeedEndUsers] = useState<number>(0); // first month only
  const [seedMAU, setSeedMAU] = useState<number>(11354); // first month only

  // Per-month overrides
  const [conversionOverrides, setConversionOverrides] = useState<Record<string, number>>({});
  const [bookingsOverrides, setBookingsOverrides] = useState<Record<string, number>>({});
  const [organicOverrides, setOrganicOverrides] = useState<Record<string, number>>({});

  const rows: MonthRow[] = useMemo(() => {
    const result: MonthRow[] = [];
    for (let i = 0; i < MONTHS.length; i += 1) {
      const key = MONTHS[i]!.key;

      const conversion = conversionOverrides[key] ?? TARGET_CONVERSION;
      const cpa = CPA_START_RUB * Math.pow(1 + CPA_MONTHLY_GROWTH, i);

      const prior = result[i - 1];
      const priorNewPaid = prior?.newPaidUsers ?? 0;
      const priorNewOrganic = prior?.newOrganic ?? 0;

      const endUsers = i === 0 ? seedEndUsers : Math.max(0, Math.round((result[i - 1]?.endUsers ?? 0) + (result[i]?.newPaidUsers ?? 0) + (result[i]?.newOrganic ?? 0)));
      // The line above references current row values that are not computed yet. We'll compute in two passes.
      // Instead, compute sequentially based on definitions:
    }
    // Two-pass compute to honor forward references
    for (let i = 0; i < MONTHS.length; i += 1) {
      const key = MONTHS[i]!.key;
      const conversion = conversionOverrides[key] ?? TARGET_CONVERSION;
      const cpa = CPA_START_RUB * Math.pow(1 + CPA_MONTHLY_GROWTH, i);

      const prior = rows[i - 1];
      const priorNewPaid = prior?.newPaidUsers ?? 0;
      const priorNewOrganic = prior?.newOrganic ?? 0;

      const endUsers = i === 0 ? seedEndUsers : Math.round((rows[i - 1]?.endUsers ?? 0) + (rows[i - 1]?.newPaidUsers ?? 0) + (rows[i - 1]?.newOrganic ?? 0));
      const retention2 = Math.round(endUsers * RETENTION);
      const mau = i === 0 ? seedMAU : Math.round(retention2 + priorNewPaid + priorNewOrganic);

      const defaultBookings = Math.round(mau * conversion);
      const bookings = bookingsOverrides[key] ?? defaultBookings;

      const revenueBookings = bookings * COMMISSION_PER_BOOKING_RUB;
      const paidSubsCount = Math.round(mau * PAID_SUBS_PERCENT_OF_MAU);
      const revenueSubs = paidSubsCount * SUBS_REVENUE_PER_USER_RUB;
      const totalRevenue = revenueBookings + revenueSubs;
      const marketingSpend = Math.round(totalRevenue * MARKETING_SHARE_TABLE);
      const newPaidUsers = Math.max(0, Math.floor(marketingSpend / cpa));
      const newOrganic = Math.max(0, Math.round(organicOverrides[key] ?? 0));

      rows[i] = {
        endUsers,
        retention2,
        mau,
        conversion,
        bookings,
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
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedEndUsers, seedMAU, conversionOverrides, bookingsOverrides, organicOverrides]);

  const periodRevenueSum = useMemo(() => rows.slice(0, 12).reduce((acc, r) => acc + r.totalRevenue, 0), [rows]);
  const periodMarketingSum = useMemo(() => rows.slice(0, 12).reduce((acc, r) => acc + r.marketingSpend, 0), [rows]);
  const leftover = periodRevenueSum - periodMarketingSum;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Финансовая модель</h1>

      {/* Top datapoints */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(280px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Card label="Комиссия со ср. брони" value={formatCurrency(COMMISSION_PER_BOOKING_RUB)} />
        <Card label="Целевая конверсия (с сент)" value={`${(TARGET_CONVERSION * 100).toFixed(1)}%`} />
        <Card label="Ретеншн" value={`${(RETENTION * 100).toFixed(0)}%`} />
        <Card label="Цена нового юзера (рост 1,5% мес)" value={formatCurrency(CPA_START_RUB)} />
        <Card label="Выручка за август 25-июль 26" value={formatCurrency(periodRevenueSum)} />
        <Card label="Траты на маркетинг от выручки" value={`${(MARKETING_SHARE_TOP * 100).toFixed(0)}%`} />
        <Card label="Маркетинг июль 25-июнь 26" value={formatCurrency(periodMarketingSum)} />
        <Card label="Остаток на прочие расходы и прибыль" value={formatCurrency(leftover)} highlight />
        <Card label="Процент платных подп. от MAU" value={`${(PAID_SUBS_PERCENT_OF_MAU * 100).toFixed(1)}%`} />
        <Card label="Выручка от 1 подписки" value={formatCurrency(SUBS_REVENUE_PER_USER_RUB)} />
      </div>

      {/* Seed inputs */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Юзеров к концу месяца (1-й месяц)</div>
          <NumberCell value={seedEndUsers} onChange={setSeedEndUsers} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>MAU (1-й месяц)</div>
          <NumberCell value={seedMAU} onChange={setSeedMAU} />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <Th>Месяц</Th>
              <Th>Юзеров к концу месяца</Th>
              <Th>Ретеншн 2</Th>
              <Th>MAU</Th>
              <Th>Конверсия</Th>
              <Th>Бронирований</Th>
              <Th>Выручка</Th>
              <Th>Платные подписки (шт.)</Th>
              <Th>Выручка подписок</Th>
              <Th>Общая выручка</Th>
              <Th>Цена нового юзера</Th>
              <Th>На маркетинг (80%)</Th>
              <Th>Новых платных юзеров</Th>
              <Th>Новая органика</Th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((m, i) => {
              const r = rows[i]!;
              const key = m.key;
              return (
                <tr key={m.key}>
                  <Td>{m.label}</Td>
                  <Td>{formatNumber(r.endUsers)}</Td>
                  <Td>{formatNumber(r.retention2)}</Td>
                  <Td>
                    {i === 0 ? (
                      <NumberCell value={r.mau} onChange={(v) => setSeedMAU(Math.max(0, Math.round(v)))} />
                    ) : (
                      formatNumber(r.mau)
                    )}
                  </Td>
                  <Td>
                    <NumberCell
                      value={Math.round((conversionOverrides[key] ?? TARGET_CONVERSION) * 1000) / 10}
                      onChange={(v) =>
                        setConversionOverrides((s) => ({ ...s, [key]: Math.max(0, Math.min(1, v / 100)) }))
                      }
                    />
                    <div style={{ fontSize: 11, color: "#6b7280" }}>%</div>
                  </Td>
                  <Td>
                    <NumberCell
                      value={bookingsOverrides[key] ?? r.bookings}
                      onChange={(v) => setBookingsOverrides((s) => ({ ...s, [key]: Math.max(0, Math.round(v)) }))}
                    />
                  </Td>
                  <Td>{formatCurrency(r.revenueBookings)}</Td>
                  <Td>{formatNumber(r.paidSubsCount)}</Td>
                  <Td>{formatCurrency(r.revenueSubs)}</Td>
                  <Td>{formatCurrency(r.totalRevenue)}</Td>
                  <Td>{formatCurrency(r.cpa)}</Td>
                  <Td>{formatCurrency(r.marketingSpend)}</Td>
                  <Td>{formatNumber(r.newPaidUsers)}</Td>
                  <Td>
                    <NumberCell
                      value={organicOverrides[key] ?? r.newOrganic}
                      onChange={(v) => setOrganicOverrides((s) => ({ ...s, [key]: Math.max(0, Math.round(v)) }))}
                    />
                  </Td>
                </tr>
              );
            })}
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
        padding: 8,
        borderBottom: "1px solid #e5e7eb",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
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


