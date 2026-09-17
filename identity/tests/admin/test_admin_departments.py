from tests.factories import add_to_department, make_app, make_department, make_user


def test_department_lifecycle_and_access(api, db, audited):
    app, roles = make_app(db, slug="crm")
    _, other_roles = make_app(db, slug="sales-crm")
    dept = api.post(
        "/admin/departments", json={"slug": "field-sales", "name": "Field sales"}
    ).json()
    access_url = f"/admin/departments/{dept['id']}/access"

    ok = api.put(access_url, json=[{"app_id": str(app.id), "app_role_id": str(roles["editor"].id)}])
    wrong_role = api.put(
        access_url, json=[{"app_id": str(app.id), "app_role_id": str(other_roles["editor"].id)}]
    )
    renamed = api.patch(f"/admin/departments/{dept['id']}", json={"name": "Sales Team"})

    assert ok.status_code == 200
    assert ok.json()["access"] == [
        {
            "app_id": str(app.id),
            "app_slug": "crm",
            "app_role_id": str(roles["editor"].id),
            "role_key": "editor",
        }
    ]
    assert wrong_role.status_code == 422
    assert renamed.json()["name"] == "Sales Team"
    assert (
        api.post("/admin/departments", json={"slug": "field-sales", "name": "Dup"}).status_code
        == 409
    )
    assert audited("department_access_replaced")


def test_department_delete_blocked_with_members(api, db):
    dept = make_department(db)
    add_to_department(db, make_user(db), dept)
    empty = make_department(db)
    assert api.delete(f"/admin/departments/{dept.id}").status_code == 409
    assert api.delete(f"/admin/departments/{empty.id}").status_code == 204
