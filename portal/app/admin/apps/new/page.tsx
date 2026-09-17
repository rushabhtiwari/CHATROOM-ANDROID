import { ActionForm, ActionMessage, SubmitButton } from "@/components/ActionForm";
import { IconPicker } from "@/components/IconPicker";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { requireAdmin } from "@/lib/admin";

import { registerApp } from "../actions";

const STATUS_OPTIONS = [
  { value: "coming_soon", label: "Coming soon" },
  { value: "active", label: "Live" },
  { value: "disabled", label: "Disabled" },
];
const GROUP_OPTIONS = [
  { value: "department", label: "Departments" },
  { value: "company", label: "Company tools" },
];

export default async function RegisterAppPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Register app"
        breadcrumb={{ href: "/admin/apps", label: "Apps" }}
        description="Add a department app or company tool. It stays coming soon until you take it live."
      />
      <ActionForm action={registerApp} className="stack form-page" showMessage={false}>
        <Card title="Details" description="How the app appears in Central">
          <div className="card-body card-grid">
            <label className="field">
              Name
              <input name="name" required placeholder="Stores" />
            </label>
            <label className="field">
              Short name
              <input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,63}" placeholder="stores" />
              <span className="hint">Becomes the client ID. Can&apos;t be changed later.</span>
            </label>
            <label className="field field-wide">
              Description
              <input name="description" placeholder="Stock levels, issues and receipts" />
            </label>
            <Segmented
              label="Group"
              name="category"
              options={GROUP_OPTIONS}
              defaultValue="department"
              hideLabel={false}
            />
            <Segmented
              label="Status"
              name="status"
              options={STATUS_OPTIONS}
              defaultValue="coming_soon"
              hideLabel={false}
            />
            <IconPicker defaultValue="" />
          </div>
        </Card>
        <Card title="Connection" description="Needed when the app is live">
          <div className="card-body card-grid">
            <label className="field field-wide">
              App address
              <input name="launch_url" type="url" placeholder="https://stores.yourco.com" />
            </label>
            <label className="field field-wide">
              Sign-in callback URLs
              <textarea name="redirect_uris" placeholder="https://stores.yourco.com/api/auth/callback/identity" />
              <span className="hint">One per line</span>
            </label>
            <label className="field field-wide">
              Sign-out return URLs
              <textarea name="post_logout_redirect_uris" placeholder="https://stores.yourco.com/" />
              <span className="hint">Optional, one per line</span>
            </label>
          </div>
        </Card>
        <Card
          title="Roles"
          description="A higher rank wins when someone's departments give different roles"
          footer={
            <>
              <ActionMessage />
              <SubmitButton>Register app</SubmitButton>
            </>
          }
        >
          <div className="card-body">
            <label className="field">
              One per line as key, label, rank
              <textarea name="roles" required defaultValue={"member, Member, 10\nmanager, Manager, 30"} />
            </label>
          </div>
        </Card>
      </ActionForm>
    </>
  );
}
