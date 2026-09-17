import { Suspense } from "react";

import { Home } from "@/components/Home";
import { TopBar } from "@/components/TopBar";
import { identity } from "@/lib/identity";

export default async function HomePage() {
  const [me, apps] = await Promise.all([identity.me(), identity.myApps()]);
  return (
    <>
      <TopBar me={me} />
      <main className="page">
        <Suspense>
          <Home
            apps={apps}
            firstName={me.name.split(" ")[0]}
            isAdmin={me.is_admin}
            departmentCount={me.departments.length}
          />
        </Suspense>
      </main>
    </>
  );
}
