import { AppMark } from "@/components/AppMark";
import type { MyApp } from "@/lib/types";

export function AppTile({ app }: { app: MyApp }) {
  const mark = <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} />;
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
