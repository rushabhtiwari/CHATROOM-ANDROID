import type { ReactNode } from "react";

export function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  tone: "primary" | "success" | "warning" | "violet";
}) {
  return (
    <div className="stat-card">
      <span className={`stat-icon stat-${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span>
        <b>{value}</b>
        <small>{label}</small>
      </span>
    </div>
  );
}
