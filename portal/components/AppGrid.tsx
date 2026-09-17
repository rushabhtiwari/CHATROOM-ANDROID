import { monogram, tileColor } from "@/lib/monogram";
import type { MyApp } from "@/lib/types";

export function AppGrid({ apps }: { apps: MyApp[] }) {
  if (apps.length === 0) {
    return (
      <div className="empty">
        <h2>No apps yet</h2>
        <p>You don&apos;t have access to any apps. Ask an admin to add you to your department.</p>
      </div>
    );
  }
  return (
    <ul className="app-grid">
      {apps.map((app) => (
        <li key={app.slug}>
          <a className="app-tile" href={app.launch_url} target="_blank" rel="noopener noreferrer">
            <span className="app-mark" style={{ backgroundColor: tileColor(app.slug) }} aria-hidden="true">
              {monogram(app.name)}
            </span>
            <span className="app-name">{app.name}</span>
            {app.description && <span className="app-description">{app.description}</span>}
            <span className="app-role">Your role: {app.role}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
