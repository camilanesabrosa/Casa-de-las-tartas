export type UpdatePhase = "unavailable" | "idle" | "checking" | "available" | "downloading" | "downloaded" | "installing" | "error";

export interface DesktopUpdateState {
  supported: boolean;
  reason: string | null;
  currentVersion: string;
  latestVersion: string | null;
  phase: UpdatePhase;
  releaseNotes: string;
  lastCheckedAt: string | null;
  progress: number;
  error: string | null;
  automatic: boolean;
  skippedVersion: string | null;
  dismissed: boolean;
}

export interface DesktopUpdatesAPI {
  getState(): Promise<DesktopUpdateState>;
  check(): Promise<DesktopUpdateState>;
  download(): Promise<DesktopUpdateState>;
  install(): Promise<DesktopUpdateState>;
  dismiss(): Promise<DesktopUpdateState>;
  skip(): Promise<DesktopUpdateState>;
  setAutomatic(enabled: boolean): Promise<DesktopUpdateState>;
  onStateChange(callback: (state: DesktopUpdateState) => void): () => void;
}

declare global {
  interface Window {
    casaDesktop?: { readonly platform: string; readonly updates: DesktopUpdatesAPI };
  }
}
