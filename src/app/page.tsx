import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Главная</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "stretch" }}>
        <Link
          href="/travelpayouts"
          style={{
            display: "inline-block",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "linear-gradient(180deg, #ffffff, #f9fafb)",
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 700,
            textAlign: "center",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          KatusAI dashBoard
        </Link>
        <Link
          href="/finmodel"
          style={{
            display: "inline-block",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "linear-gradient(180deg, #ffffff, #f9fafb)",
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 700,
            textAlign: "center",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          Финмодель
        </Link>
      </div>
    </main>
  );
}
