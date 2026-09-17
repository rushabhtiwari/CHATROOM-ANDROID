from sqlalchemy import func, select

from app.access import resolve_role
from app.models import App, User
from app.seed import seed


def test_seed_is_idempotent_and_grants_example_access(db):
    seed(db)
    seed(db)
    assert db.scalar(select(func.count()).select_from(User)) == 4
    example = db.scalar(select(App).where(App.slug == "example"))
    sam = db.scalar(select(User).where(User.email == "sam@yourco.com"))
    newbie = db.scalar(select(User).where(User.email == "newbie@yourco.com"))
    assert resolve_role(db, sam, example).key == "manager"
    assert resolve_role(db, newbie, example) is None
