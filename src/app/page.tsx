import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Главная</h1>
      <ul style={{ display: "grid", gap: 8 }}>
        <li>
          <Link href="/travelpayouts" style={{ color: "#2563eb" }}>Дашборд Travelpayouts</Link>
        </li>
        <li>
          <Link href="/finmodel" style={{ color: "#2563eb" }}>Финмодель</Link>
        </li>
      </ul>
    </main>
  );
}
