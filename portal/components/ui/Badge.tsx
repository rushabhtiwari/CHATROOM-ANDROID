import type { ReactNode } from "react";

export type BadgeTone = "success" | "neutral" | "danger" | "primary";

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
