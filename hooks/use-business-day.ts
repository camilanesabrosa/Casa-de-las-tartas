"use client";

import { useEffect, useState } from "react";
import { dateKey } from "@/lib/business";
import { nextBusinessDayDelay } from "@/lib/sales";

export function useBusinessDay() {
  const [day, setDay] = useState(() => dateKey());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setDay(dateKey(now));
      timer = setTimeout(refresh, nextBusinessDayDelay(now));
    };
    refresh();
    // Refresh after sleep or returning to the app, even if the timer was paused.
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return day;
}
