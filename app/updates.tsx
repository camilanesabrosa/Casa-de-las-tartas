"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DesktopUpdateState } from "@/lib/desktop-updates";

type UpdateAction = "check" | "download" | "install" | "dismiss" | "skip" | "automatic";

export function useDesktopUpdates() {
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<UpdateAction | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    const api = window.casaDesktop?.updates;
    if (!api) return;
    let active = true;
    let receivedEvent = false;
    const unsubscribe = api.onStateChange((next) => {
      receivedEvent = true;
      if (active) setState(next);
    });
    void api.getState().then((next) => {
      if (active && !receivedEvent) setState(next);
    }).catch(() => {
      if (active) setError("No se pudo consultar el actualizador. Volvé a abrir la app para reintentar.");
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  async function run(action: UpdateAction, automatic?: boolean) {
    const api = window.casaDesktop?.updates;
    if (!api || inFlight.current) return;
    inFlight.current = true;
    setBusy(action);
    setError("");
    try {
      const next = action === "automatic" ? await api.setAutomatic(automatic === true) : await api[action]();
      setState(next);
    } catch {
      setError("No se pudo completar la acción. Volvé a intentarlo.");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  return { state, error, busy, run };
}

type Updates = ReturnType<typeof useDesktopUpdates>;

function statusText(state: DesktopUpdateState) {
  switch (state.phase) {
    case "checking": return "Buscando actualizaciones…";
    case "available": return `Versión ${state.latestVersion} disponible`;
    case "downloading": return `Descargando actualización… ${state.progress}%`;
    case "downloaded": return `Versión ${state.latestVersion} lista para instalar`;
    case "installing": return "Abriendo el instalador…";
    case "error": return "La descarga no se completó";
    case "unavailable": return state.reason;
    default: return state.lastCheckedAt && !state.error ? "Tenés la última versión." : "Las actualizaciones se instalan cuando vos lo confirmás.";
  }
}

function UpdateActions({ updates }: { updates: Updates }) {
  const { state, busy, run } = updates;
  if (!state) return null;
  if (state.phase === "available" || state.phase === "error") return (
    <Button className="btn primary" disabled={Boolean(busy)} onClick={() => void run("download")}>
      <Download aria-hidden="true" />{state.phase === "error" ? "Reintentar descarga" : "Descargar actualización"}
    </Button>
  );
  if (state.phase === "downloaded") return (
    <Button className="btn primary" disabled={Boolean(busy)} onClick={() => void run("install")}>
      <RefreshCw aria-hidden="true" />{busy === "install" ? "Esperando confirmación…" : "Instalar y reiniciar"}
    </Button>
  );
  return null;
}

function DownloadProgress({ state }: { state: DesktopUpdateState }) {
  if (state.phase !== "downloading") return null;
  return <progress className="update-progress" max={100} value={state.progress} aria-label="Progreso de descarga" />;
}

export function UpdateBanner({ updates }: { updates: Updates }) {
  const { state, busy, run, error } = updates;
  if (!state?.supported || state.dismissed || state.latestVersion === state.skippedVersion ||
    !["available", "downloading", "downloaded", "installing", "error"].includes(state.phase)) return null;
  return (
    <section className="update-banner" aria-label="Actualización de la aplicación">
      <div className="update-message">
        <p role="status">{statusText(state)}</p>
        <DownloadProgress state={state} />
        {state.error || error ? <p className="update-error" role="alert">{error || state.error}</p> : null}
      </div>
      <div className="update-actions">
        <UpdateActions updates={updates} />
        <Button className="btn" disabled={Boolean(busy) || state.phase === "installing"} onClick={() => void run("dismiss")}>
          Más tarde
        </Button>
        {state.phase === "available" ? (
          <button className="text-link" disabled={Boolean(busy)} onClick={() => void run("skip")}>Omitir esta versión</button>
        ) : null}
      </div>
    </section>
  );
}

export function UpdateSettings({ updates }: { updates: Updates }) {
  const { state, error, busy, run } = updates;
  if (!state) return error ? <p role="alert" className="update-error">{error}</p> : null;
  const working = Boolean(busy) || ["checking", "downloading", "installing"].includes(state.phase);
  return (
    <section className="panel settings-panel update-settings">
      <div className="update-settings-heading">
        <h2>Actualizaciones</h2>
        <span className="update-version">Versión {state.currentVersion}</span>
      </div>
      <p className="muted" role="status">{statusText(state)}</p>
      <DownloadProgress state={state} />
      {state.releaseNotes ? <p className="update-notes">{state.releaseNotes}</p> : null}
      {state.lastCheckedAt ? (
        <p className="update-checked">Última búsqueda: {new Intl.DateTimeFormat("es-AR", {
          dateStyle: "short", timeStyle: "short",
        }).format(new Date(state.lastCheckedAt))}</p>
      ) : null}
      {state.skippedVersion ? <p className="update-checked">Omitiste la versión {state.skippedVersion}. Podés descargarla desde acá si sigue disponible.</p> : null}
      {state.error || error ? <p className="update-error" role="alert">{error || state.error}</p> : null}
      <label className="update-toggle">
        <input type="checkbox" checked={state.automatic} disabled={!state.supported || working}
          onChange={(event) => void run("automatic", event.target.checked)} />
        Buscar actualizaciones automáticamente
      </label>
      <div className="update-actions">
        <Button className="btn" disabled={!state.supported || working || state.phase === "downloaded"} onClick={() => void run("check")}>
          <RefreshCw aria-hidden="true" />{state.phase === "checking" ? "Buscando…" : "Buscar ahora"}
        </Button>
        <UpdateActions updates={updates} />
      </div>
    </section>
  );
}
