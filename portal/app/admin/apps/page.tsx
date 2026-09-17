import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AppMark } from "@/components/AppMark";
import { IconPicker } from "@/components/IconPicker";
import { requireAdmin } from "@/lib/admin";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/apps";
import { identity } from "@/lib/identity";

import { registerApp } from "./actions";

export default async function AppsPage() {
  await requireAdmin();
  const apps = await identity.listApps();
  return (
    <>
      <h1>Apps</h1>
      <p className="hint">Department apps and company tools that people open from Central.</p>

      <section className="table-wrap" aria-label="Registered apps">
        <table>
          <thead>
            <tr>
              <th>App</th>
              <th>Group</th>
              <th>Status</th>
              <th>Client ID</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id}>
                <td>
                  <span className="app-cell">
                    <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} />
                    <Link href={`/admin/apps/${app.id}`}>{app.name}</Link>
                    {app.is_system && <span className="hint">Built in</span>}
                  </span>
                </td>
                <td>{CATEGORY_LABELS[app.category]}</td>
                <td className={`status status-${app.status}`}>{STATUS_LABELS[app.status]}</td>
                <td>
                  <code>{app.client_id}</code>
                </td>
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
            <input name="name" required placeholder="Stores" />
          </label>
          <label>
            Short name
            <input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,63}" placeholder="stores" />
            <span className="hint">Becomes the client ID. Can&apos;t be changed later.</span>
          </label>
          <label className="wide">
            Description
            <input name="description" placeholder="Stock levels, issues and receipts" />
          </label>
          <fieldset className="radio-row wide">
            <legend>Group</legend>
            <label>
              <input type="radio" name="category" value="department" defaultChecked />
              Departments
            </label>
            <label>
              <input type="radio" name="category" value="company" />
              Company tools
            </label>
          </fieldset>
          <div className="wide">
            <IconPicker defaultValue="" />
          </div>
          <label>
            Status
            <select name="status" defaultValue="coming_soon">
              <option value="coming_soon">Coming soon</option>
              <option value="active">Live</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="wide">
            App address
            <input name="launch_url" type="url" placeholder="https://stores.yourco.com" />
            <span className="hint">Needed when the app is live.</span>
          </label>
          <label className="wide">
            Sign-in callback URLs, one per line
            <textarea name="redirect_uris" placeholder="https://stores.yourco.com/api/auth/callback/identity" />
            <span className="hint">Needed when the app is live.</span>
          </label>
          <label className="wide">
            Sign-out return URLs, one per line (optional)
            <textarea name="post_logout_redirect_uris" placeholder="https://stores.yourco.com/" />
          </label>
          <label className="wide">
            Roles, one per line as key, label, rank
            <textarea name="roles" required defaultValue={"member, Member, 10\nmanager, Manager, 30"} />
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
