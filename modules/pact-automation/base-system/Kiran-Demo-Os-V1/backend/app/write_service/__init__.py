"""The write service.

WORKING.md §1.1 gives this package a monopoly: it is the sole authority allowed
to write canonical tables. Route handlers read freely and call in here to
change anything — they never touch a store mutator directly, which is this
codebase's equivalent of the spec's "no `prisma.<entity>.create` in a route
handler" rule. `tests/test_mailing.py` checks that statically, so the boundary
is enforced rather than merely documented.
"""

from .errors import WriteServiceError

__all__ = ["WriteServiceError"]
