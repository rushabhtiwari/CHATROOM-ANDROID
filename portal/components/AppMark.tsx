"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

import { AppIcon } from "@/lib/icons";
import { appTone } from "@/lib/tones";

const GLYPH = { sm: 18, md: 26, lg: 36 } as const;

type Props = {
  slug: string;
  icon: string;
  logoVersion: number | null;
  size?: keyof typeof GLYPH;
};

/** An app's glossy gradient icon tile, or its uploaded logo (falling back to the icon if it fails). */
export function AppMark({ slug, icon, logoVersion, size = "md" }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const tone = appTone(slug);
  const showLogo = logoVersion !== null && !logoFailed;
  const style = { "--from": tone.from, "--to": tone.to } as CSSProperties;
  return (
    <span className={`app-mark app-mark-${size}${showLogo ? " app-mark-logo" : ""}`} style={style}>
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos come from an authenticated route handler
        <img src={`/logos/${slug}?v=${logoVersion}`} alt="" onError={() => setLogoFailed(true)} />
      ) : (
        <AppIcon name={icon} size={GLYPH[size]} />
      )}
    </span>
  );
}
