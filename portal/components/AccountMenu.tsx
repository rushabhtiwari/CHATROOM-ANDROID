"use client";

import { CaretDown } from "@phosphor-icons/react/ssr";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { initials } from "@/lib/people";

type Props = { name: string; email: string; roleLine: string; children: ReactNode };

export function AccountMenu({ name, email, roleLine, children }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onMouseDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  return (
    <div className="account" ref={root}>
      <button
        type="button"
        className="account-button"
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <span className="account-text">
          <b>{name}</b>
          <small>{roleLine}</small>
        </span>
        <CaretDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="account-panel">
          <p className="account-email">{email}</p>
          {children}
        </div>
      )}
    </div>
  );
}
