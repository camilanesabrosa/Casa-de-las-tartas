"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, Download, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DesktopDriveBackup, DesktopDriveState } from "@/lib/desktop-drive";

export function useDesktopDrive() {
  const [state, setState] = useState<DesktopDriveState | null>(null);
  const [backups, setBackups] = useState<DesktopDriveBackup[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    const api = window.casaDesktop?.drive;
    if (!api) return;
    let active = true;
    let gotEvent = false;
    const unsubscribe = api.onStateChange((next) => {
      gotEvent = true;
      if (active) setState(next);
    });
    void api.getState().then((next) => {
      if (active && !gotEvent) setState(next);
    }).catch(() => {
      if (active) setError("No se pudo consultar el estado de Google Drive.");
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const listBackups = useCallback(async () => {
    const api = window.casaDesktop?.drive;
    if (!api || inFlight.current) return;
    inFlight.current = true;
    setBusy("list");
    setError("");
    try {
      setBackups(await api.listBackups());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los respaldos.");
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }, []);

  async function run(action: "connect" | "backup" | "disconnect" | "restore", backupId?: string) {
    const api = window.casaDesktop?.drive;
    if (!api || inFlight.current) return;
    inFlight.current = true;
    setBusy(action);
    setError("");
    try {
      if (action === "connect") setState(await api.connect());
      if (action === "backup") setState(await api.backupNow());
      if (action === "disconnect") {
        setState(await api.disconnect());
        setBackups([]);
      }
      if (action === "restore" && backupId) await api.restoreBackup(backupId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la acción de Google Drive.");
      void api.getState().then(setState).catch(() => {});
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }

  return { state, backups, busy, error, run, listBackups };
}

export type DriveControls = ReturnType<typeof useDesktopDrive>;

function backupLabel(name: string) {
  const match = name.match(/^casa-de-las-tartas-respaldo-(?:auto|manual)-(.+)\.sqlite$/);
  if (!match) return name;
  const stamp = match[1];
  return stamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z?$/, " · $1:$2:$3");
}

export function DriveBackupSettings({ drive }: { drive: DriveControls }) {
  const { state, backups, busy, error, run, listBackups } = drive;
  const [showRestore, setShowRestore] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const configured = state?.configured ?? false;
  const connected = state?.connected ?? false;
  const working = Boolean(busy) || Boolean(state?.busy);

  async function openRestore() {
    setShowRestore(true);
    setSelectedBackup("");
    setConfirmationText("");
    await listBackups();
  }

  async function restore() {
    if (!selectedBackup || confirmationText !== "RESTAURAR") return;
    await run("restore", selectedBackup);
  }

  return (
    <section className="panel settings-panel drive-panel">
      <div className="drive-heading">
        <div>
          <h2>Respaldo en Google Drive</h2>
          <p className="muted">Guarda copias, no sincroniza en tiempo real. En otra computadora, vinculá la misma cuenta y restaurá una copia.</p>
        </div>
        <Cloud className="drive-heading-icon" aria-hidden="true" />
      </div>

      {state?.lastBackupAt ? (
        <p className="drive-status" role="status">
          <ShieldCheck aria-hidden="true" />
          Último respaldo: {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(state.lastBackupAt))}
        </p>
      ) : (
        <p className="drive-status" role="status">
          <HardDrive aria-hidden="true" />
          {state?.restoreDecisionRequired
            ? "Hay copias de otra computadora listas para restaurar."
            : connected ? "Todavía no hay copias en Drive." : "Tus datos siguen guardados en esta computadora."}
        </p>
      )}

      <p className="drive-retention">
        Conserva los 30 respaldos diarios más recientes. Las copias manuales se guardan aparte.{" "}
        <a href="https://sinnick.dev/cdt/privacy-policy/" target="_blank" rel="noreferrer">Política de privacidad</a>
      </p>

      {state?.restoreDecisionRequired ? (
        <p className="drive-restore-warning" role="alert">
          Encontramos copias de otra computadora. Restaurá una antes de continuar: los respaldos automáticos quedan pausados para protegerlas.
        </p>
      ) : null}

      {!configured ? (
        <p className="drive-setup-note">Google Drive requiere registrar la app en Google Cloud antes de vincular una cuenta.</p>
      ) : !connected ? (
        <Button className="btn primary" disabled={working} onClick={() => void run("connect")}>
          <Cloud aria-hidden="true" />
          {busy === "connect" ? "Conectando…" : "Conectar Google Drive"}
        </Button>
      ) : (
        <div className="drive-actions">
          {!state?.restoreDecisionRequired ? (
            <Button className="btn primary" disabled={working} onClick={() => void run("backup")}>
              <Download aria-hidden="true" />
              {busy === "backup" || state?.busy === "backup" ? "Guardando respaldo…" : "Crear respaldo ahora"}
            </Button>
          ) : null}
          <Button className="btn" disabled={working} onClick={() => void openRestore()}>
            <RefreshCw aria-hidden="true" />
            Ver y restaurar copias
          </Button>
          <Button className="btn drive-disconnect" disabled={working} onClick={() => void run("disconnect")}>
            Desconectar
          </Button>
        </div>
      )}

      {error || state?.lastError ? <p className="drive-error" role="alert">{error || state?.lastError}</p> : null}

      {showRestore && connected ? (
        <div className="drive-restore" role="group" aria-labelledby="drive-restore-title">
          <div className="drive-restore-heading">
            <h3 id="drive-restore-title">Restaurar una copia</h3>
            <Button className="btn" disabled={working} onClick={() => {
              setShowRestore(false);
              setConfirmationText("");
            }}>
              Cerrar
            </Button>
          </div>
          {busy === "list" ? <p className="muted" role="status">Buscando copias…</p> : backups.length ? (
            <>
              <label className="reset-confirmation-label" htmlFor="drive-backup-select">Copia disponible</label>
              <select id="drive-backup-select" className="field-input" value={selectedBackup} onChange={(event) => setSelectedBackup(event.target.value)}>
                <option value="">Elegí una copia…</option>
                {backups.map((backup) => (
                  <option key={backup.id} value={backup.id}>
                    {backupLabel(backup.name)} · {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(backup.modifiedTime))}
                  </option>
                ))}
              </select>
              <p>La app guardará la base actual en esta computadora y se reiniciará con los datos de la copia elegida.</p>
              <label className="reset-confirmation-label" htmlFor="drive-restore-confirmation">Escribí RESTAURAR para confirmar.</label>
              <input id="drive-restore-confirmation" className="field-input" autoComplete="off" value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} />
              <Button className="btn danger" disabled={working || !selectedBackup || confirmationText !== "RESTAURAR"} onClick={() => void restore()}>
                {busy === "restore" ? "Restaurando…" : "Restaurar copia y reiniciar"}
              </Button>
            </>
          ) : (
            <p className="muted">No hay copias disponibles en la carpeta de Casa de las Tartas.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
