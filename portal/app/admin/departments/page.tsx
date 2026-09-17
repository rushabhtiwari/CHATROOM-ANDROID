import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { identity } from "@/lib/identity";

import { createDepartment, deleteDepartment, renameDepartment, saveDepartmentAccess } from "./actions";

export default async function DepartmentsPage() {
  await requireAdmin();
  const [departments, apps] = await Promise.all([identity.listDepartments(), identity.listApps()]);
  const assignableApps = apps.filter((app) => !app.is_system);

  return (
    <>
      <h1>Departments</h1>
      <p className="hint">Choose which apps each department can open, and with which role.</p>

      <section aria-labelledby="new-department">
        <h2 id="new-department">Add a department</h2>
        <ActionForm action={createDepartment} className="form-grid">
          <label>
            Name
            <input name="name" required placeholder="Sales" />
          </label>
          <label>
            Short name
            <input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,63}" placeholder="sales" />
            <span className="hint">Lowercase letters, numbers and dashes.</span>
          </label>
          <div className="wide">
            <SubmitButton>Add department</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section aria-label="Departments">
        {departments.length === 0 && <p>No departments yet. Add one above.</p>}
        {departments.map((department) => {
          const current = Object.fromEntries(department.access.map((grant) => [grant.app_id, grant.app_role_id]));
          return (
            <article key={department.id} className="department" aria-labelledby={`dept-${department.id}`}>
              <div className="department-head">
                <h2 id={`dept-${department.id}`}>{department.name}</h2>
                <span className="hint">
                  {department.member_count === 1 ? "1 person" : `${department.member_count} people`}
                </span>
              </div>
              <ActionForm action={saveDepartmentAccess.bind(null, department.id)} className="form-grid">
                {assignableApps.map((app) => (
                  <label key={app.id}>
                    {app.name}
                    <select name={`app:${app.id}`} defaultValue={current[app.id] ?? ""}>
                      <option value="">No access</option>
                      {app.roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <div className="wide">
                  <SubmitButton>Save access</SubmitButton>
                </div>
              </ActionForm>
              <div className="form-row" style={{ marginTop: "1rem" }}>
                <ActionForm action={renameDepartment.bind(null, department.id)} className="form-row">
                  <label>
                    Rename
                    <input name="name" defaultValue={department.name} required />
                  </label>
                  <SubmitButton tone="quiet">Rename</SubmitButton>
                </ActionForm>
                <ActionForm action={deleteDepartment.bind(null, department.id)}>
                  <SubmitButton tone="danger">Delete department</SubmitButton>
                </ActionForm>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
