"use client";

import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useState } from "react";

import { AppMark } from "@/components/AppMark";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { accessSummary, CATEGORY_LABELS, STATUS_LABELS } from "@/lib/apps";
import type { AppStatus, AppSummary } from "@/lib/types";

const STATUS_TONES: Record<AppStatus, BadgeTone> = { active: "success", coming_soon: "neutral", disabled: "danger" };

export function AppsTable({ apps, departmentCount }: { apps: AppSummary[]; departmentCount: number }) {
  const [text, setText] = useState("");
  const [group, setGroup] = useState("");
  const [status, setStatus] = useState("");

  const needle = text.trim().toLowerCase();
  const visible = apps.filter(
    (app) =>
      (!needle || [app.name, app.description, app.client_id].some((value) => value.toLowerCase().includes(needle))) &&
      (!group || (!app.is_system && app.category === group)) &&
      (!status || app.status === status),
  );

  return (
    <div className="card table-card">
      <div className="table-toolbar">
        <label className="table-filter">
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Filter apps"
            placeholder="Filter apps"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <label className="table-select">
          <span className="visually-hidden">Group</span>
          <select aria-label="Group" value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="">All groups</option>
            <option value="department">Departments</option>
            <option value="company">Company tools</option>
          </select>
        </label>
        <label className="table-select">
          <span className="visually-hidden">Status</span>
          <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Live</option>
            <option value="coming_soon">Coming soon</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <span className="table-count">{visible.length === 1 ? "1 app" : `${visible.length} apps`}</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">App</th>
              <th scope="col">Group</th>
              <th scope="col">Status</th>
              <th scope="col">Client ID</th>
              <th scope="col">Departments with access</th>
              <th scope="col">
                <span className="visually-hidden">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((app) => (
              <tr key={app.id} className="row-link">
                <td>
                  <div className="cell-app">
                    <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} size="sm" />
                    <span>
                      <Link href={`/admin/apps/${app.id}`} className="row-link-target">
                        {app.name}
                      </Link>
                      <small>{app.is_system ? "Built in" : app.description}</small>
                    </span>
                  </div>
                </td>
                <td>{app.is_system ? "—" : CATEGORY_LABELS[app.category]}</td>
                <td>
                  <Badge tone={STATUS_TONES[app.status]}>{STATUS_LABELS[app.status]}</Badge>
                </td>
                <td>
                  <code>{app.client_id}</code>
                </td>
                <td className="muted">
                  {app.is_system ? "Everyone" : accessSummary(app.departments, departmentCount)}
                </td>
                <td className="cell-chevron" aria-hidden="true">
                  <CaretRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="table-empty">No apps match these filters.</p>}
      </div>
    </div>
  );
}
