"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

type Props = {
  /** Accessible name of the toggle button. */
  label: string;
  /** Visible button content; defaults to the label. */
  trigger?: ReactNode;
  buttonClassName?: string;
  panelClassName?: string;
  /** Float the panel like a menu (closes on Escape and outside clicks). */
  menu?: boolean;
  children: ReactNode;
};

export function Disclosure({
  label,
  trigger,
  buttonClassName = "button",
  panelClassName = "",
  menu = false,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !menu) return;
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
  }, [open, menu]);

  return (
    <div className={menu ? "disclosure disclosure-menu" : "disclosure"} ref={root}>
      <button
        type="button"
        className={buttonClassName}
        aria-expanded={open}
        aria-controls={id}
        aria-label={trigger ? label : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger ?? label}
      </button>
      <div id={id} hidden={!open} className={menu ? `menu-panel ${panelClassName}` : panelClassName}>
        {children}
      </div>
    </div>
  );
}
