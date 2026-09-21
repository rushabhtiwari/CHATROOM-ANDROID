import { ArrowRight } from "@phosphor-icons/react/ssr";
import { useId } from "react";

import { AppMark } from "@/components/AppMark";
import type { MyApp } from "@/lib/types";

/** One app on Home: its mark and its name. A live app's whole tile is the link. */
export function AppCard({ app }: { app: MyApp }) {
  const id = useId();
  const live = app.status === "active";
  const body = (
    <>
      <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} />
      <b id={`${id}-name`}>{app.name}</b>
      {/* Read out, not shown: the name already says what the tile opens. */}
      <p id={`${id}-description`} className="visually-hidden">
        {app.description}
      </p>
      {live ? (
        <ArrowRight className="app-card-go" size={18} weight="bold" aria-hidden="true" />
      ) : (
        <span className="status status-soon">Coming soon</span>
      )}
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
