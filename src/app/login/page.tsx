"use client";
import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [codephrase, setCodephrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || "/";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codephrase }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Login failed");
        setLoading(false);
        return;
      }
      router.push(from);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={onSubmit} style={{ width: 360, display: "grid", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Enter access code</h1>
        <input
          name="codephrase"
          type="password"
          value={codephrase}
          onChange={(e) => setCodephrase(e.target.value)}
          placeholder="Codephrase"
          required
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <button disabled={loading} type="submit" style={{ padding: 10, borderRadius: 8, background: "black", color: "white" }}>
          {loading ? "Checking..." : "Continue"}
        </button>
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
      </form>
    </div>
  );
}


