"use client";

import { useState } from "react";

import { AppIcon } from "@/lib/icons";
import { appTone } from "@/lib/tones";

type Props = { slug: string; icon: string; logoVersion: number | null };

/** An app's logo when it has one (falling back if it fails to load), otherwise its tinted icon. */
export function AppMark({ slug, icon, logoVersion }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const tone = appTone(slug);
  return (
    <span className="tile-mark" style={{ backgroundColor: tone.background, color: tone.color }}>
      {logoVersion !== null && !logoFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos come from an authenticated route handler
        <img src={`/logos/${slug}?v=${logoVersion}`} alt="" onError={() => setLogoFailed(true)} />
      ) : (
        <AppIcon name={icon} />
      )}
    </span>
  );
}
