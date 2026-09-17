import { Launcher } from "@/components/Launcher";
import { TopBar } from "@/components/TopBar";
import { identity } from "@/lib/identity";

export default async function Home() {
  const [me, apps] = await Promise.all([identity.me(), identity.myApps()]);
  return (
    <>
      <TopBar me={me} />
      <Launcher apps={apps} firstName={me.name.split(" ")[0]} />
    </>
  );
}
