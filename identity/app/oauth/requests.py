"""Adapts FastAPI requests to Authlib's framework-neutral OAuth2Request."""

from collections import defaultdict

from authlib.oauth2.rfc6749 import OAuth2Payload, OAuth2Request
from fastapi import Request


class _Payload(OAuth2Payload):
    def __init__(self, datalist: dict[str, list[str]]):
        self._datalist = defaultdict(list, datalist)

    @property
    def data(self) -> dict[str, str]:
        return {key: values[0] for key, values in self._datalist.items() if values}

    @property
    def datalist(self) -> defaultdict[str, list]:
        return self._datalist


def _multi(items: list[tuple[str, str]]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for key, value in items:
        out.setdefault(key, []).append(value)
    return out


class IdentityOAuth2Request(OAuth2Request):
    def __init__(
        self,
        method: str,
        uri: str,
        headers,
        query: list[tuple[str, str]],
        form: list[tuple[str, str]],
    ):
        super().__init__(method=method, uri=uri, headers=headers)
        self._args = {k: v[0] for k, v in _multi(query).items()}
        self._form = {k: v[0] for k, v in _multi(form).items()}
        self.payload = _Payload(_multi(query + form))

    @property
    def args(self) -> dict[str, str]:
        return self._args

    @property
    def form(self) -> dict[str, str]:
        return self._form


async def build_oauth_request(request: Request, issuer_url: str) -> IdentityOAuth2Request:
    """Build from the public issuer URL so Authlib's HTTPS check sees the external scheme."""
    form = list((await request.form()).multi_items()) if request.method == "POST" else []
    uri = issuer_url + request.url.path
    if request.url.query:
        uri += "?" + request.url.query
    return IdentityOAuth2Request(
        method=request.method,
        uri=uri,
        headers=request.headers,
        query=list(request.query_params.multi_items()),
        form=[(k, v) for k, v in form if isinstance(v, str)],
    )
