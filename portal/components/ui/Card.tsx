import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
};

/** A white card with an optional titled header and footer (workspace spec §3.3). */
export function Card({ title, description, actions, footer, children, className = "", labelledBy }: Props) {
  const headingId = labelledBy ?? (title ? `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
  return (
    <section className={`card ${className}`} aria-labelledby={headingId}>
      {title && (
        <div className="card-header">
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
          {actions && <div className="card-header-actions">{actions}</div>}
        </div>
      )}
      {children}
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}
