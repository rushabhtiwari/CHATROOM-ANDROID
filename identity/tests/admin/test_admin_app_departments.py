from contextlib import contextmanager

from sqlalchemy import event

from tests.factories import grant_department, make_app, make_department


@contextmanager
def count_queries(db):
    statements: list[str] = []

    def before_execute(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    engine = db.get_bind()
    event.listen(engine, "before_cursor_execute", before_execute)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", before_execute)


def test_apps_list_includes_departments_with_access_sorted_by_name(api, db):
    app, roles = make_app(db, slug="crm")
    grant_department(db, make_department(db, "zeta-team"), app, roles["viewer"])
    grant_department(db, make_department(db, "alpha-team"), app, roles["manager"])

    listed = {a["slug"]: a for a in api.get("/admin/apps").json()}
    detail = api.get(f"/admin/apps/{app.id}").json()

    expected = [
        {"slug": "alpha-team", "name": "Alpha-Team"},
        {"slug": "zeta-team", "name": "Zeta-Team"},
    ]
    assert listed["crm"]["departments"] == expected
    assert detail["departments"] == expected
    assert [g["department_slug"] for g in detail["grants"]] == ["alpha-team", "zeta-team"]
    assert listed["chat"]["departments"][0] == {"slug": "accounts", "name": "Accounts"}
    assert len(listed["chat"]["departments"]) == 9
    assert listed["portal"]["departments"] == []


def test_apps_list_query_count_does_not_grow_with_apps(api, db):
    api.get("/admin/apps")  # warm up: token verification, key loading
    with count_queries(db) as before:
        api.get("/admin/apps")
    for _ in range(5):
        app, roles = make_app(db)
        grant_department(db, make_department(db), app, roles["viewer"])
    with count_queries(db) as after:
        api.get("/admin/apps")

    assert len(after) == len(before)
