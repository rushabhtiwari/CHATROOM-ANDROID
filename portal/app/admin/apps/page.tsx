import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { identity } from "@/lib/identity";

import { registerApp } from "./actions";

export default async function AppsPage() {
  await requireAdmin();
  const apps = await identity.listApps();
  return (
    <>
      <h1>Apps</h1>
      <p className="hint">Apps that sign people in through Central.</p>

      <section className="table-wrap" aria-label="Registered apps">
        <table>
          <thead>
            <tr>
              <th>App</th>
              <th>Client ID</th>
              <th>Roles</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id}>
                <td>
                  <Link href={`/admin/apps/${app.id}`}>{app.name}</Link>
                  {app.is_system && <div className="hint">Built in</div>}
                </td>
                <td>
                  <code>{app.client_id}</code>
                </td>
                <td>{app.roles.map((r) => r.label).join(", ")}</td>
                <td className={`status status-${app.status}`}>{app.status === "active" ? "Active" : "Disabled"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="register-app">
        <h2 id="register-app">Register an app</h2>
        <ActionForm action={registerApp} className="form-grid">
          <label>
            Name
            <input name="name" required placeholder="Invoicing" />
          </label>
          <label>
            Short name
            <input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,63}" placeholder="invoicing" />
            <span className="hint">Becomes the client ID. Can&apos;t be changed later.</span>
          </label>
          <label className="wide">
            Description
            <input name="description" placeholder="Raise and track customer invoices" />
          </label>
          <label className="wide">
            App address
            <input name="launch_url" type="url" required placeholder="https://invoicing.yourco.com" />
          </label>
          <label className="wide">
            Sign-in callback URLs, one per line
            <textarea
              name="redirect_uris"
              required
              placeholder="https://invoicing.yourco.com/api/auth/callback/identity"
            />
          </label>
          <label className="wide">
            Sign-out return URLs, one per line (optional)
            <textarea name="post_logout_redirect_uris" placeholder="https://invoicing.yourco.com/" />
          </label>
          <label className="wide">
            Roles, one per line as key, label, rank
            <textarea name="roles" required defaultValue={"viewer, Viewer, 10\nmanager, Manager, 30"} />
            <span className="hint">A higher rank wins when someone&apos;s departments give different roles.</span>
          </label>
          <div className="wide">
            <SubmitButton>Register app</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
