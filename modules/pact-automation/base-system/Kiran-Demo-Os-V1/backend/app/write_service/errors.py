"""The one error type the write service raises."""

from __future__ import annotations


class WriteServiceError(Exception):
    """A refusal the operator should see.

    `status_code` travels with the message so routers stay thin: they catch
    this and re-raise it as an HTTPException without deciding anything.
    """

    def __init__(self, message: str, status_code: int = 409) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
