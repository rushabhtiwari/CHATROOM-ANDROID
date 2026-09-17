"use client";

import { Buildings, GearSix, HourglassMedium, RocketLaunch, SmileyBlank, SquaresFour } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { AppCard } from "@/components/AppCard";
import { SEARCH_SET_EVENT, SEARCH_SUBMIT_EVENT } from "@/components/GlobalSearch";
import { Segmented } from "@/components/ui/Segmented";
import { StatCard } from "@/components/ui/StatCard";
import { Switch } from "@/components/ui/Switch";
import { firstLiveMatch, formatDate, greetingFor, groupApps, type HomeTab, summarise, tabCounts } from "@/lib/home";
import type { MyApp } from "@/lib/types";

type Props = { apps: MyApp[]; firstName: string; isAdmin: boolean; departmentCount: number };

const subscribeToNothing = () => () => {};

export function Home({ apps, firstName, isAdmin, departmentCount }: Props) {
  const query = useSearchParams().get("q") ?? "";
  const [tab, setTab] = useState<HomeTab>("all");
  const [liveOnly, setLiveOnly] = useState(false);
  // Time and date are only known in the browser; the server renders neutral text.
  const now = useSyncExternalStore(
    subscribeToNothing,
    () => new Date().toDateString() + "|" + new Date().getHours(),
    () => null,
  );
  const [dateText, hour] = now ? [formatDate(new Date()), Number(now.split("|")[1])] : ["", null];

  const groups = groupApps(apps, { query, tab, liveOnly });
  const counts = tabCounts(apps, query, liveOnly);
  const summary = summarise(apps, departmentCount);

  useEffect(() => {
    function onSubmit() {
      const match = firstLiveMatch(groups);
      if (match) window.open(match.launch_url, "_blank", "noopener,noreferrer");
    }
    window.addEventListener(SEARCH_SUBMIT_EVENT, onSubmit);
    return () => window.removeEventListener(SEARCH_SUBMIT_EVENT, onSubmit);
  }, [groups]);

  function clearSearch() {
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.pathname + url.search);
    window.dispatchEvent(new CustomEvent(SEARCH_SET_EVENT, { detail: "" }));
  }

  return (
    <>
      <header className="page-header home-header">
        <div className="page-header-text">
          <p className="home-date">{dateText}</p>
          <h1>
            {greetingFor(hour)}, {firstName}
          </h1>
        </div>
        {isAdmin && (
          <div className="page-header-actions">
            <Link href="/admin/apps" className="button">
              <GearSix size={16} aria-hidden="true" />
              Manage apps
            </Link>
          </div>
        )}
      </header>

      {apps.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon" aria-hidden="true">
            <SmileyBlank size={34} weight="duotone" />
          </span>
          <h2>No apps yet</h2>
          <p>Ask an admin to add you to your department.</p>
        </div>
      ) : (
        <>
          <ul className="stat-grid" aria-label="Summary">
            <li>
              <StatCard
                icon={<SquaresFour size={22} weight="duotone" />}
                value={summary.total}
                label="Apps you can open"
                tone="primary"
              />
            </li>
            <li>
              <StatCard
                icon={<RocketLaunch size={22} weight="duotone" />}
                value={summary.live}
                label="Live now"
                tone="success"
              />
            </li>
            <li>
              <StatCard
                icon={<HourglassMedium size={22} weight="duotone" />}
                value={summary.soon}
                label="Coming soon"
                tone="warning"
              />
            </li>
            <li>
              <StatCard
                icon={<Buildings size={22} weight="duotone" />}
                value={summary.departments}
                label="Your departments"
                tone="violet"
              />
            </li>
          </ul>

          <div className="home-toolbar">
            <Segmented
              label="Show"
              value={tab}
              onChange={(value) => setTab(value as HomeTab)}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "department", label: "Departments", count: counts.department },
                { value: "company", label: "Company tools", count: counts.company },
              ]}
            />
            <Switch label="Live only" checked={liveOnly} onChange={setLiveOnly} />
          </div>

          {groups.length === 0 && (
            <div className="card empty-state">
              <p>{query.trim() ? `No apps match "${query.trim()}".` : "No apps match these filters."}</p>
              {query.trim() && (
                <button type="button" className="button" onClick={clearSearch}>
                  Clear search
                </button>
              )}
            </div>
          )}

          {groups.map((group) => (
            <section key={group.category} className="app-section" aria-labelledby={`section-${group.category}`}>
              <div className="section-head">
                <h2 id={`section-${group.category}`}>{group.label}</h2>
                <span className="count-pill">{group.apps.length}</span>
                <p>{group.description}</p>
              </div>
              <ul className="app-grid">
                {group.apps.map((app) => (
                  <li key={app.slug}>
                    <AppCard app={app} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
