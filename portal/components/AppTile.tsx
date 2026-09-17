"use client";

import { useState } from "react";

import { AppIcon } from "@/lib/icons";
import { appTone } from "@/lib/tones";
import type { MyApp } from "@/lib/types";

export function AppTile({ app }: { app: MyApp }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const tone = appTone(app.slug);
  const mark = (
    <span className="tile-mark" style={{ backgroundColor: tone.background, color: tone.color }}>
      {app.logo_version !== null && !logoFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos come from an authenticated route handler
        <img src={`/logos/${app.slug}?v=${app.logo_version}`} alt="" onError={() => setLogoFailed(true)} />
      ) : (
        <AppIcon name={app.icon} />
      )}
    </span>
  );

  if (app.status === "active") {
    return (
      <a className="tile" href={app.launch_url} target="_blank" rel="noopener noreferrer" title={app.description}>
        {mark}
        <span className="tile-name">{app.name}</span>
      </a>
    );
  }
  return (
    <div className="tile tile-soon" aria-disabled="true" title={`${app.description}. Coming soon.`}>
      {mark}
      <span className="tile-name">{app.name}</span>
      <span className="soon">Soon</span>
    </div>
  );
}
