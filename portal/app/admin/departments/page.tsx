import { DotsThree, Plus } from "@phosphor-icons/react/ssr";

import { ActionForm, ActionMessage, SubmitButton } from "@/components/ActionForm";
import { AppMark } from "@/components/AppMark";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/admin";
import { identity } from "@/lib/identity";

import { createDepartment, deleteDepartment, renameDepartment, saveDepartmentAccess } from "./actions";

export default async function DepartmentsPage() {
  await requireAdmin();
  const [departments, apps] = await Promise.all([identity.listDepartments(), identity.listApps()]);
  const assignableApps = apps.filter((app) => !app.is_system);

  return (
    <>
      <PageHeader
        title="Departments"
        description="Choose which apps each department can open, and with which role."
        actions={
          <Disclosure
            label="Add department"
            trigger={
              <>
                <Plus size={16} weight="bold" aria-hidden="true" />
                Add department
              </>
            }
            buttonClassName="button button-primary"
            panelClassName="add-department-panel"
          >
            <ActionForm action={createDepartment} showMessage={false}>
              <Card
                title="New department"
                footer={
                  <>
                    <ActionMessage />
                    <SubmitButton>Create department</SubmitButton>
                  </>
                }
              >
                <div className="card-body card-grid">
                  <label className="field">
                    Name
                    <input name="name" required placeholder="Stores" />
                  </label>
                  <label className="field">
                    Short name
                    <input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,63}" placeholder="stores" />
                    <span className="hint">Lowercase letters, numbers and dashes</span>
                  </label>
                </div>
              </Card>
            </ActionForm>
          </Disclosure>
        }
      />

      {departments.length === 0 && <p className="card table-empty">No departments yet.</p>}

      <div className="stack">
        {departments.map((department) => {
          const current = Object.fromEntries(department.access.map((grant) => [grant.app_id, grant.app_role_id]));
          return (
            <Card
              key={department.id}
              title={department.name}
              labelledBy={`department-${department.id}`}
              description={department.member_count === 1 ? "1 person" : `${department.member_count} people`}
              actions={
                <Disclosure
                  label={`More actions for ${department.name}`}
                  trigger={<DotsThree size={18} weight="bold" aria-hidden="true" />}
                  buttonClassName="button button-small icon-button"
                  menu
                >
                  <ActionForm action={renameDepartment.bind(null, department.id)} className="menu-form">
                    <label className="field">
                      Rename
                      <input name="name" defaultValue={department.name} required />
                    </label>
                    <SubmitButton tone="quiet" small>
                      Save name
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteDepartment.bind(null, department.id)} className="menu-form">
                    <SubmitButton tone="danger" small>
                      Delete department
                    </SubmitButton>
                  </ActionForm>
                </Disclosure>
              }
            >
              <ActionForm action={saveDepartmentAccess.bind(null, department.id)} showMessage={false}>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">App</th>
                        <th scope="col">Role for this department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignableApps.map((app) => (
                        <tr key={app.id}>
                          <td>
                            <label className="cell-app" htmlFor={`${department.id}-${app.id}`}>
                              <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} size="sm" />
                              <span>{app.name}</span>
                            </label>
                          </td>
                          <td>
                            <select
                              id={`${department.id}-${app.id}`}
                              name={`app:${app.id}`}
                              defaultValue={current[app.id] ?? ""}
                            >
                              <option value="">No access</option>
                              {app.roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card-footer">
                  <ActionMessage />
                  <SubmitButton>Save access</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          );
        })}
      </div>
    </>
  );
}
