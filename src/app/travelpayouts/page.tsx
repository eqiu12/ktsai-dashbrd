"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";

type Balance = { usd: string; eur: string; rub: string };
type NextPayout = { usd: string; eur: string; rub: string };
type Action = {
  actionId: string;
  actionState: string;
  price: string;
  profit: string;
  description?: string;
  bookedAt?: string;
  updatedAtRemote?: string;
};

type DashboardResponse = {
  balance: Balance | null;
  nextPayout: NextPayout | null;
  actions: Action[];
  daily: Array<{ date: string; clicks: number; bookings: number; earnings: string }>;
  payments: Array<{ paymentUuid: string; paidAt: string; amount: string; currency: string; comment?: string }>;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fetcherAggregates = (groupBy: string) => fetch(`/api/travelpayouts/aggregates?groupBy=${groupBy}`).then((r) => r.json());

export default function TravelpayoutsDashboardPage() {
  const formatCurrency = (value: string | number | null | undefined) => {
    const n = Number(value ?? 0);
    const parts = n.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${parts.join(".")} ₽`;
  };
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(10);
  const [page, setPage] = useState(0);
  const { data, isLoading, error } = useSWR<DashboardResponse>(`/api/travelpayouts/dashboard?limit=${pageSize}&offset=${page * pageSize}`, fetcher, {
    refreshInterval: 60_000,
  });
  const [groupBy, setGroupBy] = useState<"date" | "month" | "program">("month");
  const { data: aggregates } = useSWR<{ groupBy: string; rows: any[] }>(
    ["aggregates", groupBy],
    () => fetcherAggregates(groupBy),
    { refreshInterval: 120_000 }
  );
  const { data: dailyAgg } = useSWR<{ groupBy: string; rows: any[] }>(
    ["aggregates", "date"],
    () => fetcherAggregates("date"),
    { refreshInterval: 300_000 }
  );
  const { data: monthAgg } = useSWR<{ groupBy: string; rows: any[] }>(
    ["aggregates", "month"],
    () => fetcherAggregates("month"),
    { refreshInterval: 300_000 }
  );
  const programNames: Record<string, string> = {
    "100": "Aviasales",
    "121": "Trip.com",
    "193": "Yandex",
    "101": "Hotellook",
  };
  const mauByMonth: Record<string, number> = {
    "01": 5060,   // January
    "02": 4087,   // February
    "03": 4347,   // March
    "04": 4386,   // April
    "05": 7395,   // May
    "06": 7681,   // June
    "07": 11354,  // July
    // "08": undefined, // August (not provided)
    "09": 2430,   // September
    "10": 3451,   // October
    "11": 3777,   // November
    "12": 2341,   // December
  };
  const firstColLabel = groupBy === "month" ? "Month" : groupBy === "date" ? "Date" : "Program (campaignId)";
  const totals = useMemo(() => {
    const rows = aggregates?.rows || [];
    if (!rows.length) return null;
    const sum = rows.reduce(
      (acc: any, r: any) => {
        acc.actions += Number(r.actions || 0);
        acc.paid += Number(r.paid || 0);
        acc.processing += Number(r.processing || 0);
        acc.cancelled += Number(r.cancelled || 0);
        acc.paid_profit_rub += Number(r.paid_profit_rub || 0);
        acc.pending_profit_rub += Number(r.pending_profit_rub || 0);
        acc.total_profit_rub += Number(r.total_profit_rub || 0);
        return acc;
      },
      { actions: 0, paid: 0, processing: 0, cancelled: 0, paid_profit_rub: 0, pending_profit_rub: 0, total_profit_rub: 0 }
    );
    const avg = sum.paid > 0 ? sum.paid_profit_rub / sum.paid : 0;
    return { ...sum, avg_profit_per_booking_rub: avg };
  }, [aggregates]);

  const kpis = useMemo(() => {
    if (!data) return null;
    const rubBalance = data.balance?.rub ?? "0";
    const rubNext = data.nextPayout?.rub ?? "0";
    const totalEarnings = data.daily.reduce((acc, d) => acc + Number(d.earnings), 0); // already RUB
    const totalClicks = data.daily.reduce((acc, d) => acc + d.clicks, 0);
    const totalBookings = data.daily.reduce((acc, d) => acc + d.bookings, 0);
    const conversion = totalClicks > 0 ? ((totalBookings / totalClicks) * 100).toFixed(2) : "0.00";
    return { rubBalance, rubNext, totalEarnings, totalClicks, totalBookings, conversion };
  }, [data]);

  const charts = useMemo(() => {
    const rows = (dailyAgg?.rows || []).slice().sort((a: any, b: any) => (a.key < b.key ? -1 : 1));
    if (!rows.length) return null;
    const dates: string[] = rows.map((r: any) => r.key);
    const paid: number[] = rows.map((r: any) => Number(r.paid || 0));
    const processing: number[] = rows.map((r: any) => Number(r.processing || 0));
    const totalProfit: number[] = rows.map((r: any) => Number(r.total_profit_rub || 0));
    const paidProfit: number[] = rows.map((r: any) => Number(r.paid_profit_rub || 0));
    const avgProfitPerBooking: number[] = rows.map((r: any) => Number(r.avg_profit_per_booking_rub || 0));
    const paidPlusProcessing = paid.map((v, i) => v + (processing[i] || 0));

    const rolling = (arr: number[], window: number) => {
      const out: number[] = [];
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
        if (i >= window) sum -= arr[i - window];
        const denom = i + 1 < window ? i + 1 : window;
        out.push(denom > 0 ? sum / denom : 0);
      }
      return out;
    };
    const rollingSum = (arr: number[], window: number) => {
      const out: number[] = [];
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
        if (i >= window) sum -= arr[i - window];
        out.push(sum);
      }
      return out;
    };

    return {
      dates,
      totalProfit30: rolling(totalProfit, 30),
      actions30: rolling(paidPlusProcessing, 30),
      profitPerBooking30: rolling(avgProfitPerBooking, 30),
      totalProfit30Sum: rollingSum(totalProfit, 30),
      actions30Sum: rollingSum(paidPlusProcessing, 30),
    };
  }, [dailyAgg]);

  const monthlySeries = useMemo(() => {
    const rows = (monthAgg?.rows || []).slice().sort((a: any, b: any) => (a.key < b.key ? -1 : 1));
    if (!rows.length) return null;
    const months: string[] = rows.map((r: any) => r.key);
    const paid: number[] = rows.map((r: any) => Number(r.paid || 0));
    const processing: number[] = rows.map((r: any) => Number(r.processing || 0));
    const actionsPP: number[] = paid.map((v, i) => v + (processing[i] || 0));
    const totalProfit: number[] = rows.map((r: any) => Number(r.total_profit_rub || 0));
    const mau: number[] = months.map((k: string) => mauByMonth[String(k).slice(5, 7)] ?? 0);
    const conversion: number[] = months.map((k: string, i: number) => {
      const prevMonth = String(((parseInt(k.slice(5, 7), 10) + 10) % 12) + 1).padStart(2, "0");
      const prevMau = mauByMonth[prevMonth] ?? 0;
      return prevMau > 0 ? actionsPP[i] / prevMau : 0;
    });
    return { months, actionsPP, totalProfit, mau, conversion };
  }, [monthAgg]);

  const LineChart = ({ values, dates, label, isCurrency = false }: { values: number[]; dates: string[]; label: string; isCurrency?: boolean }) => {
    const [hover, setHover] = useState<number | null>(null);
    if (!values.length) return <div className="p-4 text-sm text-gray-500">No data</div>;
    const width = 700;
    const height = 220;
    const paddingLeft = 48;
    const paddingRight = 16;
    const paddingTop = 12;
    const paddingBottom = 28;
    const innerW = width - paddingLeft - paddingRight;
    const innerH = height - paddingTop - paddingBottom;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const xs = (i: number) => paddingLeft + (i / Math.max(1, values.length - 1)) * innerW;
    const ys = (v: number) => {
      const norm = (v - min) / (max - min || 1);
      return paddingTop + (1 - norm) * innerH;
    };
    const path = values
      .map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`)
      .join(" ");

    // Y axis ticks
    const yTicks: Array<{ y: number; v: number }> = [];
    const yTickCount = 4;
    for (let t = 0; t <= yTickCount; t++) {
      const v = min + ((max - min) * t) / yTickCount;
      yTicks.push({ y: ys(v), v });
    }

    // X axis ticks (6 evenly spaced)
    const xTicks: Array<{ x: number; i: number; d: string }> = [];
    const xTickCount = 6;
    for (let t = 0; t <= xTickCount; t++) {
      const i = Math.round((t / xTickCount) * (values.length - 1));
      xTicks.push({ x: xs(i), i, d: dates[i] });
    }

    const lastVal = values[values.length - 1];
    const onMove = (evt: React.MouseEvent<SVGRectElement>) => {
      const rect = (evt.target as SVGRectElement).getBoundingClientRect();
      const mx = evt.clientX - rect.left;
      const ratio = (mx - paddingLeft) / Math.max(1, innerW);
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(ratio * (values.length - 1))));
      setHover(idx);
    };

    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">{label}</div>
          <div className="text-sm font-medium">{isCurrency ? formatCurrency(lastVal) : Number(lastVal || 0).toFixed(2)}</div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56">
          <rect x={0} y={0} width={width} height={height} fill="#fff" />
          {/* Axes */}
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + innerH} stroke="#e5e7eb" />
          <line x1={paddingLeft} y1={paddingTop + innerH} x2={paddingLeft + innerW} y2={paddingTop + innerH} stroke="#e5e7eb" />
          {/* Y ticks */}
          {yTicks.map((t, idx) => (
            <g key={`yt-${idx}`}>
              <line x1={paddingLeft} y1={t.y} x2={paddingLeft + innerW} y2={t.y} stroke="#f3f4f6" />
              <text x={paddingLeft - 6} y={t.y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#6b7280">
                {isCurrency ? formatCurrency(t.v).replace(/ \/?₽?$/, "") : Number(t.v).toFixed(0)}
              </text>
            </g>
          ))}
          {/* X ticks */}
          {xTicks.map((t, idx) => (
            <g key={`xt-${idx}`}>
              <line x1={t.x} y1={paddingTop + innerH} x2={t.x} y2={paddingTop + innerH + 4} stroke="#9ca3af" />
              <text x={t.x} y={paddingTop + innerH + 14} textAnchor="middle" dominantBaseline="hanging" fontSize="10" fill="#6b7280">
                {t.d}
              </text>
            </g>
          ))}
          {/* Line */}
          <path d={path} fill="none" stroke="#2563eb" strokeWidth={2} />
          {/* Hover */}
          {hover !== null && (
            <g>
              <line x1={xs(hover)} y1={paddingTop} x2={xs(hover)} y2={paddingTop + innerH} stroke="#93c5fd" />
              <circle cx={xs(hover)} cy={ys(values[hover])} r={3} fill="#2563eb" />
              <rect x={Math.min(xs(hover) + 8, width - 130)} y={paddingTop + 8} width={122} height={44} rx={6} ry={6} fill="#111827" opacity={0.9} />
              <text x={Math.min(xs(hover) + 14, width - 124)} y={paddingTop + 24} fontSize="11" fill="#fff">
                {dates[hover]}
              </text>
              <text x={Math.min(xs(hover) + 14, width - 124)} y={paddingTop + 40} fontSize="11" fill="#fff">
                {isCurrency ? formatCurrency(values[hover]) : Number(values[hover]).toFixed(2)}
              </text>
            </g>
          )}
          <rect x={0} y={0} width={width} height={height} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      </div>
    );
  };

  const CombinedChart = ({ months, actions, mau, conversion }: { months: string[]; actions: number[]; mau: number[]; conversion: number[] }) => {
    const [hover, setHover] = useState<number | null>(null);
    if (!months.length) return <div className="p-4 text-sm text-gray-500">No data</div>;
    const width = 900;
    const height = 260;
    const paddingLeft = 56;
    const paddingRight = 56;
    const paddingTop = 12;
    const paddingBottom = 32;
    const innerW = width - paddingLeft - paddingRight;
    const innerH = height - paddingTop - paddingBottom;
    const maxCount = Math.max(...actions, ...mau, 1);
    const maxConv = Math.max(...conversion, 0.01);
    const xs = (i: number) => paddingLeft + (i / Math.max(1, months.length - 1)) * innerW;
    const yCount = (v: number) => paddingTop + (1 - v / maxCount) * innerH;
    const yConv = (v: number) => paddingTop + (1 - v / maxConv) * innerH;
    const pathFor = (vals: number[], yMap: (v: number) => number) =>
      vals.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${yMap(v).toFixed(1)}`).join(" ");

    const yTicksLeft = Array.from({ length: 4 + 1 }, (_, t) => {
      const v = (maxCount * t) / 4;
      return { y: yCount(v), v };
    });
    const yTicksRight = Array.from({ length: 4 + 1 }, (_, t) => {
      const v = (maxConv * t) / 4;
      return { y: yConv(v), v };
    });
    const xTicks = Array.from({ length: 6 + 1 }, (_, t) => {
      const i = Math.round((t / 6) * (months.length - 1));
      return { x: xs(i), d: months[i] };
    });

    const onMove = (evt: React.MouseEvent<SVGRectElement>) => {
      const rect = (evt.target as SVGRectElement).getBoundingClientRect();
      const mx = evt.clientX - rect.left;
      const ratio = (mx - paddingLeft) / Math.max(1, innerW);
      const idx = Math.max(0, Math.min(months.length - 1, Math.round(ratio * (months.length - 1))));
      setHover(idx);
    };

    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">MAU, Actions (Paid+Processing) and Conversion %</div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
          <rect x={0} y={0} width={width} height={height} fill="#fff" />
          {/* Axes */}
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + innerH} stroke="#e5e7eb" />
          <line x1={paddingLeft} y1={paddingTop + innerH} x2={paddingLeft + innerW} y2={paddingTop + innerH} stroke="#e5e7eb" />
          <line x1={paddingLeft + innerW} y1={paddingTop} x2={paddingLeft + innerW} y2={paddingTop + innerH} stroke="#e5e7eb" />
          {/* Y left ticks (counts) */}
          {yTicksLeft.map((t, idx) => (
            <g key={`yl-${idx}`}>
              <line x1={paddingLeft} y1={t.y} x2={paddingLeft + innerW} y2={t.y} stroke="#f3f4f6" />
              <text x={paddingLeft - 6} y={t.y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#6b7280">
                {String(Math.trunc(t.v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
              </text>
            </g>
          ))}
          {/* Y right ticks (percent) */}
          {yTicksRight.map((t, idx) => (
            <g key={`yr-${idx}`}>
              <text x={paddingLeft + innerW + 6} y={t.y} textAnchor="start" dominantBaseline="middle" fontSize="10" fill="#6b7280">
                {(t.v * 100).toFixed(1)}%
              </text>
            </g>
          ))}
          {/* X ticks */}
          {xTicks.map((t, idx) => (
            <g key={`xm-${idx}`}>
              <line x1={t.x} y1={paddingTop + innerH} x2={t.x} y2={paddingTop + innerH + 4} stroke="#9ca3af" />
              <text x={t.x} y={paddingTop + innerH + 14} textAnchor="middle" dominantBaseline="hanging" fontSize="10" fill="#6b7280">
                {t.d}
              </text>
            </g>
          ))}
          {/* Lines */}
          <path d={pathFor(actions, yCount)} fill="none" stroke="#2563eb" strokeWidth={2} />
          <path d={pathFor(mau, yCount)} fill="none" stroke="#10b981" strokeWidth={2} />
          <path d={pathFor(conversion, yConv)} fill="none" stroke="#ef4444" strokeWidth={2} />
          {/* Legend */}
          <g>
            <rect x={paddingLeft} y={paddingTop} width={12} height={2} fill="#2563eb" />
            <text x={paddingLeft + 18} y={paddingTop + 4} fontSize="10" fill="#374151">Actions</text>
            <rect x={paddingLeft + 80} y={paddingTop} width={12} height={2} fill="#10b981" />
            <text x={paddingLeft + 98} y={paddingTop + 4} fontSize="10" fill="#374151">MAU</text>
            <rect x={paddingLeft + 140} y={paddingTop} width={12} height={2} fill="#ef4444" />
            <text x={paddingLeft + 158} y={paddingTop + 4} fontSize="10" fill="#374151">Conversion %</text>
          </g>
          {/* Hover */}
          {hover !== null && (
            <g>
              <line x1={xs(hover)} y1={paddingTop} x2={xs(hover)} y2={paddingTop + innerH} stroke="#93c5fd" />
              <circle cx={xs(hover)} cy={yCount(actions[hover])} r={3} fill="#2563eb" />
              <circle cx={xs(hover)} cy={yCount(mau[hover])} r={3} fill="#10b981" />
              <circle cx={xs(hover)} cy={yConv(conversion[hover])} r={3} fill="#ef4444" />
              <rect x={Math.min(xs(hover) + 8, width - 180)} y={paddingTop + 8} width={172} height={64} rx={6} ry={6} fill="#111827" opacity={0.9} />
              <text x={Math.min(xs(hover) + 14, width - 174)} y={paddingTop + 24} fontSize="11" fill="#fff">{months[hover]}</text>
              <text x={Math.min(xs(hover) + 14, width - 174)} y={paddingTop + 40} fontSize="11" fill="#fff">Actions: {String(actions[hover]).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}</text>
              <text x={Math.min(xs(hover) + 14, width - 174)} y={paddingTop + 56} fontSize="11" fill="#fff">MAU: {String(mau[hover]).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}, Conv: {(conversion[hover] * 100).toFixed(2)}%</text>
            </g>
          )}
          <rect x={0} y={0} width={width} height={height} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      </div>
    );
  };

  const [trendMode, setTrendMode] = useState<"days" | "months">("days");

  return (
    <div className="p-6 space-y-6 scroll-smooth">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">KatusAI dashBoard</h1>
        <a
          href="/api/travelpayouts/sync"
          className="text-sm text-blue-600 hover:underline"
        >
          Sync now
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="#aggregates" className="px-3 py-1 border rounded text-sm hover:bg-gray-50">Aggregates</a>
        <a href="#balances" className="px-3 py-1 border rounded text-sm hover:bg-gray-50">Balances</a>
        <a href="#recent-actions" className="px-3 py-1 border rounded text-sm hover:bg-gray-50">Recent Actions</a>
        <a href="#recent-payments" className="px-3 py-1 border rounded text-sm hover:bg-gray-50">Recent Payments (RUB)</a>
        <a href="#trends" className="px-3 py-1 border rounded text-sm hover:bg-gray-50">Trends</a>
      </div>

      {isLoading && <div className="text-gray-500">Loading…</div>}
      {error && <div className="text-red-600">Failed to load</div>}

      <section id="aggregates" className="rounded-lg border">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-medium">Aggregates</div>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
          >
            <option value="month">By month</option>
            <option value="date">By date</option>
            <option value="program">By program</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">{firstColLabel}</th>
                <th className="px-3 py-2 text-right">Actions</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Processing</th>
                <th className="px-3 py-2 text-right">Cancelled</th>
                {groupBy === "month" && <th className="px-3 py-2 text-right">MAU</th>}
                <th className="px-3 py-2 text-right">Paid Profit (₽)</th>
                <th className="px-3 py-2 text-right">Pending Profit (₽)</th>
                <th className="px-3 py-2 text-right">Total Profit (₽)</th>
                <th className="px-3 py-2 text-right">Avg ₽/booking</th>
              </tr>
            </thead>
            <tbody>
              {aggregates?.rows?.map((r: any) => (
                <tr key={`${groupBy}-${r.key}`} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2">{groupBy === "program" ? `${programNames[String(r.key)] ?? "Program " + String(r.key)} (${String(r.key)})` : r.key}</td>
                  <td className="px-3 py-2 text-right">{r.actions}</td>
                  <td className="px-3 py-2 text-right">{r.paid}</td>
                  <td className="px-3 py-2 text-right">{r.processing}</td>
                  <td className="px-3 py-2 text-right">{r.cancelled}</td>
                  {groupBy === "month" && (
                    <td className="px-3 py-2 text-right">{(() => { const mm = String(r.key).slice(5,7); const mau = mauByMonth[mm]; return mau != null ? mau : "—"; })()}</td>
                  )}
                  <td className="px-3 py-2 text-right">{formatCurrency(r.paid_profit_rub)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.pending_profit_rub)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.total_profit_rub)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.avg_profit_per_booking_rub)}</td>
                </tr>
              ))}
              {totals && (
                <tr className="font-semibold bg-gray-100">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{totals.actions}</td>
                  <td className="px-3 py-2 text-right">{totals.paid}</td>
                  <td className="px-3 py-2 text-right">{totals.processing}</td>
                  <td className="px-3 py-2 text-right">{totals.cancelled}</td>
                  {groupBy === "month" && <td className="px-3 py-2 text-right">—</td>}
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.paid_profit_rub)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.pending_profit_rub)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.total_profit_rub)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totals.avg_profit_per_booking_rub)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        
      </section>

      {kpis && (
        <section id="balances" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Current Balance (RUB)</div>
            <div className="text-2xl font-semibold">{formatCurrency(kpis.rubBalance)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Next Payout (RUB)</div>
            <div className="text-2xl font-semibold">{formatCurrency(kpis.rubNext)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total Earnings (period, RUB)</div>
            <div className="text-2xl font-semibold">{formatCurrency(kpis.totalEarnings)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Clicks</div>
            <div className="text-2xl font-semibold">{kpis.totalClicks}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Bookings</div>
            <div className="text-2xl font-semibold">{kpis.totalBookings}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Conversion</div>
            <div className="text-2xl font-semibold">{kpis.conversion}%</div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4">
          <section id="recent-actions" className="rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="font-medium">Recent Actions</div>
            <div className="flex items-center gap-2 text-sm">
              <span>Show</span>
              <select
                className="border rounded px-2 py-1"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value) as any); setPage(0); }}
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Booking date</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Paid Profit</th>
                  <th className="px-3 py-2 text-right">Processing Profit</th>
                </tr>
              </thead>
              <tbody>
                {data?.actions.map((a) => (
                  <tr key={a.actionId} className="odd:bg-white even:bg-gray-50">
                    <td className="px-3 py-2">{a.bookedAt || a.updatedAtRemote || "—"}</td>
                    <td className="px-3 py-2">{a.description ?? a.actionId}</td>
                    <td className="px-3 py-2">{a.actionState}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(a.price)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(a.profit)}</td>
                    <td className="px-3 py-2 text-right">{a.processingProfit ? formatCurrency(a.processingProfit) : "—"}</td>
                  </tr>
                ))}
                {!data?.actions?.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-gray-500">No recent actions</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 flex items-center justify-between text-sm">
            <button
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <div className="text-gray-600">Page {page + 1}</div>
            <button
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.actions?.length || data.actions.length < pageSize}
            >
              Next
            </button>
          </div>
        </section>

        

        <section id="recent-payments" className="rounded-lg border">
          <div className="p-4 border-b font-medium">Recent Payments (RUB)</div>
          <div className="divide-y">
            {data?.payments?.slice(0, 10).map((p) => (
              <div key={p.paymentUuid} className="p-4 flex items-center justify-between text-sm">
                <div className="space-y-1">
                  <div className="font-medium">{p.paymentUuid}</div>
                  <div className="text-gray-500">Paid at: {p.paidAt}</div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-semibold">{formatCurrency(p.amount)}</div>
                  {p.comment && <div className="text-gray-500">{p.comment}</div>}
                </div>
              </div>
            ))}
            {!data?.payments?.length && <div className="p-4 text-gray-500">No recent payments</div>}
          </div>
        </section>

        {/* Charts */}
        <section id="trends" className="rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="font-medium">Trends</div>
            <div className="flex items-center gap-1 text-sm">
              <button className={`px-3 py-1 border rounded-l ${trendMode === "days" ? "bg-gray-100" : "bg-white"}`} onClick={() => setTrendMode("days")}>Days</button>
              <button className={`px-3 py-1 border rounded-r ${trendMode === "months" ? "bg-gray-100" : "bg-white"}`} onClick={() => setTrendMode("months")}>Months</button>
            </div>
          </div>
          {trendMode === "days" && (
            <div className="grid grid-cols-1 xl:grid-cols-3">
              {charts && (
                <>
                  <LineChart values={charts.actions30} dates={charts.dates} label="30d Avg — Actions (Paid + Processing)" />
                  <LineChart values={charts.totalProfit30} dates={charts.dates} label="30d Avg — Total Profit (₽)" isCurrency />
                  <LineChart values={charts.profitPerBooking30} dates={charts.dates} label="30d Avg — Profit per Booking (₽)" isCurrency />
                </>
              )}
              {!charts && <div className="p-4 text-sm text-gray-500">Loading…</div>}
            </div>
          )}
          {trendMode === "months" && (
            <div className="grid grid-cols-1 xl:grid-cols-3">
              {charts && (
                <>
                  <LineChart values={charts.totalProfit30Sum} dates={charts.dates} label="30d Sum — Total Profit (₽)" isCurrency />
                  <LineChart values={charts.actions30Sum} dates={charts.dates} label="30d Sum — Actions (Paid + Processing)" />
                  <LineChart values={charts.profitPerBooking30} dates={charts.dates} label="30d Avg — Profit per Booking (₽)" isCurrency />
                </>
              )}
              {!charts && <div className="p-4 text-sm text-gray-500">Loading…</div>}
            </div>
          )}
        </section>

        {/* Always show monthly conversion table and charts */}
        {monthlySeries && (
          <section className="rounded-lg border">
            <div className="overflow-x-auto">
              <div className="p-4 font-medium">Conversion (Monthly)</div>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Month</th>
                    <th className="px-3 py-2 text-right">Paid + Processing Actions</th>
                    <th className="px-3 py-2 text-right">Prev Month MAU</th>
                    <th className="px-3 py-2 text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySeries.months.map((m, i) => {
                    const prevMonth = String(((parseInt(m.slice(5, 7), 10) + 10) % 12) + 1).padStart(2, "0");
                    const prevMau = mauByMonth[prevMonth] ?? 0;
                    const actionsPP = monthlySeries.actionsPP[i];
                    const conv = prevMau > 0 ? actionsPP / prevMau : 0;
                    const formatInt = (n: number) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                    return (
                      <tr key={`conv2-${m}`} className="odd:bg-white even:bg-gray-50">
                        <td className="px-3 py-2">{m}</td>
                        <td className="px-3 py-2 text-right">{formatInt(actionsPP)}</td>
                        <td className="px-3 py-2 text-right">{prevMau ? formatInt(prevMau) : "—"}</td>
                        <td className="px-3 py-2 text-right">{prevMau ? `${(conv * 100).toFixed(2)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3">
              <LineChart values={monthlySeries.totalProfit} dates={monthlySeries.months} label="Monthly — Total Profit (₽)" isCurrency />
              <LineChart values={monthlySeries.actionsPP} dates={monthlySeries.months} label="Monthly — Actions (Paid + Processing)" />
              <CombinedChart months={monthlySeries.months} actions={monthlySeries.actionsPP} mau={monthlySeries.mau} conversion={monthlySeries.conversion} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}


