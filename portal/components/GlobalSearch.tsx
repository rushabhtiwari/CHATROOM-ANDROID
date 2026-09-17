"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Fired on the home page when the search is submitted, so it can open the first live match. */
export const SEARCH_SUBMIT_EVENT = "central:search-submit";
/** Fired by the home page to change the search text (e.g. "Clear search"). */
export const SEARCH_SET_EVENT = "central:search-set";

export function GlobalSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const input = useRef<HTMLInputElement>(null);
  // On narrow screens the field collapses to an icon button; this tracks whether it is expanded.
  const [open, setOpen] = useState(Boolean(params.get("q")));

  function expand() {
    setOpen(true);
    input.current?.focus();
    // On narrow screens the field only shows once the update renders, so try again on the next frame.
    requestAnimationFrame(() => input.current?.focus());
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      const shortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (shortcut || (event.key === "/" && !typing)) {
        event.preventDefault();
        expand();
      }
    }
    function onSet(event: Event) {
      setValue((event as CustomEvent<string>).detail);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(SEARCH_SET_EVENT, onSet);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(SEARCH_SET_EVENT, onSet);
    };
  }, []);

  function update(next: string) {
    setValue(next);
    if (pathname !== "/") return;
    const url = new URL(window.location.href);
    if (next.trim()) url.searchParams.set("q", next);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  return (
    <>
      <button
        type="button"
        className="button icon-button search-toggle"
        aria-label="Open search"
        aria-expanded={open}
        hidden={open}
        onClick={expand}
      >
        <MagnifyingGlass size={18} aria-hidden="true" />
      </button>
      <form
        role="search"
        className="global-search"
        data-open={open}
        onSubmit={(event) => {
          event.preventDefault();
          if (pathname === "/") window.dispatchEvent(new Event(SEARCH_SUBMIT_EVENT));
          else router.push(value.trim() ? `/?q=${encodeURIComponent(value.trim())}` : "/");
        }}
      >
        <MagnifyingGlass size={17} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          aria-label="Search apps"
          placeholder="Search apps, departments and tools"
          autoComplete="off"
          value={value}
          onChange={(event) => update(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !value) event.currentTarget.blur();
          }}
          onBlur={() => {
            if (!value.trim()) setOpen(false);
          }}
        />
        <kbd aria-hidden="true">⌘ K</kbd>
      </form>
    </>
  );
}
