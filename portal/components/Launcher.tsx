"use client";

import { MagnifyingGlass as Search } from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AppTile } from "@/components/AppTile";
import { firstLiveMatch, greetingFor, groupApps } from "@/lib/launcher";
import type { MyApp } from "@/lib/types";

const subscribeToNothing = () => () => {};

export function Launcher({ apps, firstName }: { apps: MyApp[]; firstName: string }) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  // The hour is only known in the browser; the server renders a neutral greeting.
  const hour = useSyncExternalStore(
    subscribeToNothing,
    () => new Date().getHours(),
    () => null,
  );
  const groups = groupApps(apps, query);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        search.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="launcher">
      <h1>
        {greetingFor(hour)}, {firstName}
      </h1>

      {apps.length === 0 ? (
        <p className="launcher-empty">You don&apos;t have any apps yet. Ask an admin to add you to your department.</p>
      ) : (
        <>
          <label className="launcher-search">
            <Search size={18} aria-hidden="true" />
            <input
              ref={search}
              type="search"
              aria-label="Find an app"
              placeholder="Find an app"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const match = firstLiveMatch(groups);
                if (match) window.open(match.launch_url, "_blank", "noopener,noreferrer");
              }}
            />
          </label>

          {groups.length === 0 && <p className="launcher-empty">No apps match &quot;{query.trim()}&quot;.</p>}

          {groups.map((group) => (
            <section key={group.category} className="launcher-group" aria-labelledby={`group-${group.category}`}>
              <h2 id={`group-${group.category}`}>{group.label}</h2>
              <ul>
                {group.apps.map((app) => (
                  <li key={app.slug}>
                    <AppTile app={app} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
