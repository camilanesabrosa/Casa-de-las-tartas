import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { UpdateBanner, UpdateSettings, useDesktopUpdates } from "../app/updates";
import type { DesktopUpdateState } from "../lib/desktop-updates";

function updates(overrides: Partial<DesktopUpdateState> = {}): ReturnType<typeof useDesktopUpdates> {
  return { error: "", busy: null, run: async () => {}, state: {
    supported: true, reason: null, currentVersion: "0.1.0", latestVersion: "0.2.0",
    phase: "available", releaseNotes: "", lastCheckedAt: null, progress: 0, error: null,
    automatic: true, skippedVersion: null, dismissed: false, ...overrides,
  } };
}

test("interfaz de actualizaciones: aviso ofrece descargar, posponer u omitir", () => {
  const html = renderToStaticMarkup(<UpdateBanner updates={updates()} />);
  for (const label of ["0.2.0", "Descargar actualización", "Más tarde", "Omitir esta versión"])
    assert.ok(html.includes(label));
  assert.ok(!html.includes("Instalar y reiniciar"));
});

test("interfaz de actualizaciones: progreso accesible e instalación solo cuando está lista", () => {
  const downloading = renderToStaticMarkup(<UpdateBanner updates={updates({ phase: "downloading", progress: 42 })} />);
  assert.match(downloading, /<progress[^>]*value="42"[^>]*aria-label="Progreso de descarga"/);
  assert.ok(!downloading.includes("Instalar y reiniciar"));
  const ready = renderToStaticMarkup(<UpdateBanner updates={updates({ phase: "downloaded" })} />);
  assert.ok(ready.includes("Instalar y reiniciar"));
  const failed = renderToStaticMarkup(<UpdateBanner updates={updates({ phase: "error", error: "Error de descarga" })} />);
  assert.ok(failed.includes('role="alert"'));
  assert.ok(failed.includes("Reintentar descarga"));
  assert.ok(!failed.includes("Instalar y reiniciar"));
});

test("interfaz de actualizaciones: avisos omitidos no molestan y siguen accesibles en configuración", () => {
  for (const state of [{ dismissed: true }, { skippedVersion: "0.2.0" }, { supported: false }])
    assert.equal(renderToStaticMarkup(<UpdateBanner updates={updates(state)} />), "");
  const settings = renderToStaticMarkup(<UpdateSettings updates={updates({ skippedVersion: "0.2.0" })} />);
  assert.ok(settings.includes("Descargar actualización"));
  assert.ok(settings.includes("Omitiste la versión"));
});

test("interfaz de actualizaciones: notas son texto y las plataformas no compatibles tienen controles deshabilitados", () => {
  const notes = renderToStaticMarkup(<UpdateSettings updates={updates({ releaseNotes: '<script>alert("x")</script>' })} />);
  assert.ok(!notes.includes("<script>"));
  assert.ok(notes.includes("&lt;script&gt;"));
  const unsupported = renderToStaticMarkup(<UpdateSettings updates={updates({ supported: false,
    phase: "unavailable", reason: "Disponible en Windows x64" })} />);
  assert.ok(unsupported.includes("Disponible en Windows x64"));
  assert.match(unsupported, /<input[^>]*disabled=""/);
  assert.match(unsupported, /<button[^>]*disabled=""/);
});

test("interfaz de actualizaciones: en el navegador no muestra controles de escritorio", () => {
  const web = { ...updates(), state: null };
  assert.equal(renderToStaticMarkup(<UpdateBanner updates={web} />), "");
  assert.equal(renderToStaticMarkup(<UpdateSettings updates={web} />), "");
});
