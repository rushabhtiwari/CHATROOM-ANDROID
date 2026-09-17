import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: ReactNode;
  breadcrumb?: { href: string; label: string };
  media?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, breadcrumb, media, actions }: Props) {
  return (
    <header className="page-header">
      {media}
      <div className="page-header-text">
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="breadcrumb">
            <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
            <span aria-hidden="true">/</span>
            <span>{title}</span>
          </nav>
        )}
        <h1>{title}</h1>
        {description && <div className="page-header-description">{description}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
