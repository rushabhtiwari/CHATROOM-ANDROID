import { Key } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { ActionForm, ActionMessage, SubmitButton } from "@/components/ActionForm";
import { LogoDropZone } from "@/components/admin/LogoUploader";
import { AppMark } from "@/components/AppMark";
import { IconPicker } from "@/components/IconPicker";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { requireAdmin } from "@/lib/admin";
import { STATUS_LABELS } from "@/lib/apps";
import { identity } from "@/lib/identity";

import {
  addRole,
  deleteRole,
  removeLogo,
  rotateSecret,
  updateAppConnection,
  updateAppSettings,
  uploadLogo,
} from "../actions";

const STATUS_OPTIONS = [
  { value: "active", label: "Live" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "disabled", label: "Disabled" },
];
const GROUP_OPTIONS = [
  { value: "department", label: "Departments" },
  { value: "company", label: "Company tools" },
];
const STATUS_TONE = { active: "success", coming_soon: "neutral", disabled: "danger" } as const;

export default async function AppPage({ params }: PageProps<"/admin/apps/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const app = await identity.getApp(id);
  const locked = app.is_system;

  return (
    <>
      <PageHeader
        title={app.name}
        breadcrumb={{ href: "/admin/apps", label: "Apps" }}
        media={<AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} size="lg" />}
        description={
          <>
            Client ID <code>{app.client_id}</code>
            <Badge tone={STATUS_TONE[app.status]}>{STATUS_LABELS[app.status]}</Badge>
          </>
        }
        actions={
          !locked && (
            <ActionForm action={rotateSecret.bind(null, app.id)} className="header-action-form">
              <SubmitButton tone="quiet">
                <Key size={16} aria-hidden="true" />
                Create new secret
              </SubmitButton>
            </ActionForm>
          )
        }
      />

      <div className="two-column">
        <div className="stack">
          <ActionForm action={updateAppSettings.bind(null, app.id, locked)} showMessage={false}>
            <Card
              title="Settings"
              description="How the app appears in Central"
              footer={
                <>
                  <ActionMessage />
                  <SubmitButton>Save changes</SubmitButton>
                </>
              }
            >
              <div className="card-body card-grid">
                <label className="field">
                  Name
                  <input name="name" defaultValue={app.name} required />
                </label>
                {!locked && (
                  <Segmented
                    label="Status"
                    name="status"
                    options={STATUS_OPTIONS}
                    defaultValue={app.status}
                    hideLabel={false}
                  />
                )}
                <label className="field field-wide">
                  Description
                  <input name="description" defaultValue={app.description} />
                </label>
                {!locked && (
                  <>
                    <Segmented
                      label="Group"
                      name="category"
                      options={GROUP_OPTIONS}
                      defaultValue={app.category}
                      hideLabel={false}
                    />
                    <IconPicker defaultValue={app.icon} />
                  </>
                )}
              </div>
            </Card>
          </ActionForm>

          {locked ? (
            <Card title="Connection">
              <p className="card-body muted">
                The portal&apos;s addresses and secret come from its deployment settings.
              </p>
            </Card>
          ) : (
            <ActionForm action={updateAppConnection.bind(null, app.id)} showMessage={false}>
              <Card
                title="Connection"
                description="Needed before the app can go live"
                footer={
                  <>
                    <ActionMessage />
                    <SubmitButton>Save connection</SubmitButton>
                  </>
                }
              >
                <div className="card-body card-grid">
                  <label className="field field-wide">
                    App address
                    <input
                      name="launch_url"
                      type="url"
                      defaultValue={app.launch_url}
                      placeholder={`https://${app.slug}.yourco.com`}
                    />
                  </label>
                  <label className="field field-wide">
                    Sign-in callback URLs
                    <textarea
                      name="redirect_uris"
                      defaultValue={app.redirect_uris.join("\n")}
                      placeholder={`https://${app.slug}.yourco.com/api/auth/callback/identity`}
                    />
                    <span className="hint">One per line</span>
                  </label>
                  <label className="field field-wide">
                    Sign-out return URLs
                    <textarea
                      name="post_logout_redirect_uris"
                      defaultValue={app.post_logout_redirect_uris.join("\n")}
                    />
                    <span className="hint">Optional, one per line</span>
                  </label>
                </div>
              </Card>
            </ActionForm>
          )}

          <Card title="Roles" description="Keys are sent to the app when people sign in">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Label</th>
                    <th scope="col">Key</th>
                    <th scope="col">Rank</th>
                    {!locked && (
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {app.roles.map((role) => (
                    <tr key={role.id}>
                      <td>{role.label}</td>
                      <td>
                        <code>{role.key}</code>
                      </td>
                      <td>{role.rank}</td>
                      {!locked && (
                        <td className="cell-actions">
                          <ActionForm action={deleteRole.bind(null, app.id, role.id)}>
                            <SubmitButton tone="danger" small>
                              Delete
                            </SubmitButton>
                          </ActionForm>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!locked && (
              <ActionForm action={addRole.bind(null, app.id)} className="card-body inline-form">
                <label className="field">
                  Key
                  <input name="key" required pattern="[a-z][a-z0-9_]{0,63}" placeholder="approver" />
                </label>
                <label className="field">
                  Label
                  <input name="label" required placeholder="Approver" />
                </label>
                <label className="field">
                  Rank
                  <input name="rank" type="number" min={0} required placeholder="20" />
                </label>
                <SubmitButton tone="quiet">Add role</SubmitButton>
              </ActionForm>
            )}
          </Card>
        </div>

        <aside className="stack">
          {!locked && (
            <Card title="Logo">
              <div className="card-body logo-card">
                <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} size="lg" />
                <ActionForm action={uploadLogo.bind(null, app.id)} className="logo-form">
                  <LogoDropZone />
                  <SubmitButton tone="quiet">{app.logo_version === null ? "Upload logo" : "Replace logo"}</SubmitButton>
                </ActionForm>
                {app.logo_version !== null && (
                  <ActionForm action={removeLogo.bind(null, app.id)}>
                    <SubmitButton tone="danger" small>
                      Remove logo
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            </Card>
          )}
          <Card title="Access">
            <dl className="card-body key-values">
              <div>
                <dt>Departments</dt>
                <dd>
                  {app.is_system ? (
                    "Everyone"
                  ) : app.grants.length === 0 ? (
                    <>
                      None yet. <Link href="/admin/departments">Grant access</Link>
                    </>
                  ) : (
                    app.grants.map((grant) => (
                      <span key={grant.department_id} className="kv-line">
                        {grant.department_name} ·{" "}
                        {app.roles.find((role) => role.id === grant.app_role_id)?.label ?? grant.role_key}
                      </span>
                    ))
                  )}
                </dd>
              </div>
              <div>
                <dt>Roles</dt>
                <dd>{app.roles.map((role) => role.label).join(", ")}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}
