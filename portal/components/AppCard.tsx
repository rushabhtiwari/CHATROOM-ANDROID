import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import { useId } from "react";

import { AppMark } from "@/components/AppMark";
import { roleLabel } from "@/lib/home";
import type { MyApp } from "@/lib/types";

export function AppCard({ app }: { app: MyApp }) {
  const id = useId();
  const live = app.status === "active";
  const body = (
    <>
      <div className="app-card-body">
        <div className="app-card-head">
          <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} />
          <span>
            <b id={`${id}-name`}>{app.name}</b>
            <small>{app.category === "company" ? "Company tool" : "Department"}</small>
          </span>
        </div>
        <p id={`${id}-description`}>{app.description}</p>
      </div>
      <div className="app-card-foot">
        {live ? (
          <>
            <span className="status status-live">Live</span>
            <span className="app-card-role">· {roleLabel(app.role)}</span>
            <span className="app-card-open" aria-hidden="true">
              Open
              <ArrowUpRight size={14} weight="bold" />
            </span>
          </>
        ) : (
          <span className="status status-soon">Coming soon</span>
        )}
      </div>
    </>
  );

  if (live) {
    return (
      <a
        className="app-card"
        href={app.launch_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-labelledby={`${id}-name`}
        aria-describedby={`${id}-description`}
      >
        {body}
      </a>
    );
  }
  return (
    <div className="app-card app-card-soon" aria-disabled="true">
      {body}
    </div>
  );
}
