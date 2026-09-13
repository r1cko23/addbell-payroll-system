"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  poDateTextToYmd,
  ymdToPoDateText,
} from "@/lib/purchase-order-date";

type PoDateInputProps = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
};

export function PoDateInput({ id, value, onChange, className }: PoDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const ymd = poDateTextToYmd(value);

  useEffect(() => {
    if (!picking) return;
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
    } catch {
      /* Browser may block showPicker if the control is not visible yet. */
    }
  }, [picking]);

  return (
    <Input
      ref={inputRef}
      id={id}
      type={picking ? "date" : "text"}
      value={picking ? ymd : value}
      placeholder="e.g. Sep. 13, 2026"
      className={className}
      onClick={() => setPicking(true)}
      onChange={(event) => {
        const next = event.target.value;
        if (picking) {
          if (!next) return;
          onChange(ymdToPoDateText(next));
          return;
        }
        onChange(next);
      }}
      onBlur={() => {
        setPicking(false);
        if (!value.trim()) return;
        const nextYmd = poDateTextToYmd(value);
        if (nextYmd) onChange(ymdToPoDateText(nextYmd));
      }}
    />
  );
}
