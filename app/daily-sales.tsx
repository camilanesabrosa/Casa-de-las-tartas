"use client";

import { ArrowRight } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { money, type Sale } from "@/lib/business";
import { salesForDay } from "@/lib/sales";

export function DailySalesShortcut({ sales, day, onOpen }: {
  sales: Sale[];
  day: string;
  onOpen: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  const paid = salesForDay(sales, day);
  const amount = money(paid.reduce((sum, sale) => sum + sale.total, 0));
  const count = `${paid.length} ${paid.length === 1 ? "venta" : "ventas"}`;
  return (
    <button type="button" className="sidebar-sales"
      aria-label={`Ver ventas cobradas de hoy: ${amount}, ${count}`}
      onClick={() => { onOpen(); setOpenMobile(false); }}>
      <span className="sidebar-sales-label">Vendido hoy</span>
      <strong className="sidebar-sales-amount">{amount}</strong>
      <span className="sidebar-sales-footer">
        <span>{count}</span>
        <span className="sidebar-sales-link">Ver detalle <ArrowRight aria-hidden="true" /></span>
      </span>
    </button>
  );
}
