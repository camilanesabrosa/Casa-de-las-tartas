"use client";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Store, ArrowRight, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DEMO_ACCOUNT } from "@/lib/demo-account";

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/session", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email")).trim(), password: form.get("password") }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error);
      window.location.assign("/admin");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No pudimos iniciar sesión.");
      setBusy(false);
    }
  }
  return <main className="login-page">
    <a href="/" className="text-link"><ArrowLeft /> Volver al catálogo</a>
    <section className="panel login-panel">
      <span className="brand-mark"><Store /></span>
      <p className="login-eyebrow">MOSTRADOR · ADMINISTRACIÓN</p>
      <h1>Tu negocio, en orden.</h1>
      <p>Entrá para editar los productos, actualizar precios y registrar las ventas.</p>
      <div className="demo-access"><UserRound /><div>
        <strong>Acceso de prueba</strong>
        <p>Usuario: {DEMO_ACCOUNT.email}<br />Contraseña: {DEMO_ACCOUNT.password}</p>
      </div></div>
      <form className="form-stack" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label className="field"><span>Usuario</span><Input className="field-input" name="email" type="email" autoComplete="username" defaultValue={DEMO_ACCOUNT.email} required /></label>
          <label className="field"><span>Contraseña</span><Input className="field-input" name="password" type="password" autoComplete="current-password" defaultValue={DEMO_ACCOUNT.password} required /></label>
        </fieldset>
        {error && <p className="error-message" role="alert">{error}</p>}
        <Button className="btn primary full login-submit" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar a la administración"}<ArrowRight /></Button>
      </form>
      <p className="login-note">Es una muestra compartida. Los cambios se ven en el catálogo de prueba. Usá datos ficticios.</p>
    </section>
  </main>;
}
