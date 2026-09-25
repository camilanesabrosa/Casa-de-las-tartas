export interface DesktopDriveState {
  configured: boolean;
  connected: boolean;
  busy: "backup" | null;
  lastBackupAt: string | null;
  lastError: string;
}

export interface DesktopDriveBackup {
  id: string;
  name: string;
  modifiedTime: string;
  size: number;
}

export interface DesktopDriveAPI {
  getState(): Promise<DesktopDriveState>;
  connect(): Promise<DesktopDriveState>;
  backupNow(): Promise<DesktopDriveState>;
  listBackups(): Promise<DesktopDriveBackup[]>;
  restoreBackup(id: string): Promise<void>;
  disconnect(): Promise<DesktopDriveState>;
  markReady(): void;
  dataChanged(): void;
  onStateChange(callback: (state: DesktopDriveState) => void): () => void;
}

declare global {
  interface Window {
    casaDesktop?: {
      readonly platform: string;
      readonly updates: import("./desktop-updates").DesktopUpdatesAPI;
      readonly drive?: DesktopDriveAPI;
    };
  }
}
