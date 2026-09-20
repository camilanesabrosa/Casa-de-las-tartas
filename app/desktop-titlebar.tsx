"use client";

import { useSyncExternalStore } from "react";
import { APP_NAME } from "@/lib/branding";
import { appPath } from "@/lib/paths";

declare global {
  interface Window {
    casaDesktop?: { readonly platform: string };
  }
}

const subscribe = () => () => {};
const getPlatform = () => window.casaDesktop?.platform;
const getServerPlatform = () => undefined;

export function DesktopTitlebar() {
  const platform = useSyncExternalStore(
    subscribe,
    getPlatform,
    getServerPlatform,
  );
  if (!platform) return null;

  return (
    <div className="desktop-titlebar" data-platform={platform}>
      <div className="desktop-titlebar-name">
        {/* Local SVG: no image loader or network access is needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={appPath("/brand/icon.svg")}
          width={28}
          height={28}
          alt=""
          draggable={false}
        />
        <span>{APP_NAME}</span>
      </div>
    </div>
  );
}
