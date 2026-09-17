import { AppGrid } from "@/components/AppGrid";
import { TopBar } from "@/components/TopBar";
import { identity } from "@/lib/identity";

export default async function Dashboard() {
  const [me, apps] = await Promise.all([identity.me(), identity.myApps()]);
  const firstName = me.name.split(" ")[0];
  return (
    <>
      <TopBar me={me} />
      <main className="dashboard">
        <h1>Hello, {firstName}</h1>
        <p className="lede">
          {apps.length === 1 ? "You can open 1 app." : `You can open ${apps.length} apps.`} Each opens in a new tab,
          already signed in.
        </p>
        <AppGrid apps={apps} />
      </main>
    </>
  );
}
