# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Sign-in through the Central Platform.

KCMS is one tile in the Central launcher, and the person opening it has already signed in
there. These two views run the OpenID Connect authorization-code flow (with PKCE) against
Central's identity service, so the tile opens straight into the workspace instead of
asking for a second password.

Settings, all from the environment:

    CENTRAL_ISSUER_URL      the identity service as the *browser* reaches it
    CENTRAL_INTERNAL_URL    the same service as *this container* reaches it (defaults to the issuer)
    CENTRAL_CLIENT_ID       the app's client id in Central (default "projects")
    CENTRAL_CLIENT_SECRET   its secret
    CENTRAL_WORKSPACE       workspace a first-time person joins (default: the oldest one)

With no issuer or secret set the views send the browser to the ordinary sign-in form.
"""

import base64
import hashlib
import os
import secrets
from urllib.parse import urlencode, urljoin

import requests
from django.http import HttpResponseRedirect
from django.views import View

from plane.authentication.utils.host import base_host
from plane.authentication.utils.login import user_login
from plane.authentication.utils.redirection_path import get_redirection_path
from plane.db.models import Profile, Project, ProjectMember, User, Workspace, WorkspaceMember
from plane.utils.path_validator import validate_next_path

ADMIN, MEMBER = 20, 15
LOCAL_FORM = "?local=1"


def _settings():
    issuer = os.environ.get("CENTRAL_ISSUER_URL", "").rstrip("/")
    return {
        "issuer": issuer,
        "internal": os.environ.get("CENTRAL_INTERNAL_URL", "").rstrip("/") or issuer,
        "client_id": os.environ.get("CENTRAL_CLIENT_ID", "projects"),
        "client_secret": os.environ.get("CENTRAL_CLIENT_SECRET", ""),
        "workspace": os.environ.get("CENTRAL_WORKSPACE", ""),
    }


def _callback_url(request):
    return urljoin(base_host(request=request, is_app=True), "/auth/central/callback/")


def _local_form(host, error=None):
    # ?local=1 tells the web app to show its own form rather than bounce back here.
    url = urljoin(host, LOCAL_FORM)
    if error:
        url += "&" + urlencode({"error_code": "5000", "error_message": error})
    return HttpResponseRedirect(url)


class CentralInitiateEndpoint(View):
    def get(self, request):
        host = base_host(request=request, is_app=True)
        conf = _settings()
        if not conf["issuer"] or not conf["client_secret"]:
            return _local_form(host)

        next_path = request.GET.get("next_path")
        verifier = secrets.token_urlsafe(48)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        state = secrets.token_urlsafe(24)

        request.session["host"] = host
        request.session["central_state"] = state
        request.session["central_verifier"] = verifier
        request.session["next_path"] = str(validate_next_path(next_path)) if next_path else ""

        query = urlencode({
            "response_type": "code",
            "client_id": conf["client_id"],
            "redirect_uri": _callback_url(request),
            "scope": "openid email profile",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        })
        return HttpResponseRedirect(f"{conf['issuer']}/authorize?{query}")


class CentralCallbackEndpoint(View):
    def get(self, request):
        host = request.session.get("host") or base_host(request=request, is_app=True)
        conf = _settings()
        state = request.session.pop("central_state", None)
        verifier = request.session.pop("central_verifier", None)
        next_path = request.session.pop("next_path", "")
        code = request.GET.get("code")

        if not code or not state or state != request.GET.get("state"):
            return _local_form(host, "CENTRAL_SIGN_IN_FAILED")

        try:
            token = requests.post(
                f"{conf['internal']}/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": _callback_url(request),
                    "code_verifier": verifier,
                },
                auth=(conf["client_id"], conf["client_secret"]),
                timeout=10,
            )
            token.raise_for_status()
            person = requests.get(
                f"{conf['internal']}/userinfo",
                headers={"Authorization": f"Bearer {token.json()['access_token']}"},
                timeout=10,
            )
            person.raise_for_status()
            claims = person.json()
            email = claims["email"].strip().lower()
        except (requests.RequestException, KeyError, ValueError, AttributeError):
            return _local_form(host, "CENTRAL_SIGN_IN_FAILED")

        user = self._person(email, claims.get("name") or "")
        self._join(user, conf["workspace"], ADMIN if claims.get("role") == "manager" else MEMBER)
        user_login(request=request, user=user, is_app=True)

        path = str(validate_next_path(next_path)) if next_path else get_redirection_path(user=user)
        return HttpResponseRedirect(urljoin(host, path))

    @staticmethod
    def _person(email, name):
        first, _, last = name.partition(" ")
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email,
                "first_name": first,
                "last_name": last,
                "display_name": first or email.split("@")[0],
                "is_active": True,
                "is_email_verified": True,
                "is_password_autoset": True,
            },
        )
        if created:
            user.set_unusable_password()
            user.save()

        # Central has already decided who this is, so there is nothing to onboard.
        profile, _ = Profile.objects.get_or_create(user=user)
        if not profile.is_onboarded:
            profile.is_onboarded = True
            profile.is_tour_completed = True
            profile.onboarding_step = {
                "workspace_join": True,
                "profile_complete": True,
                "workspace_create": True,
                "workspace_invite": True,
            }
            profile.save()
        return user

    @staticmethod
    def _join(user, slug, role):
        if WorkspaceMember.objects.filter(member=user, is_active=True).exists():
            return
        workspace = Workspace.objects.filter(slug=slug).first() if slug else None
        workspace = workspace or Workspace.objects.order_by("created_at").first()
        if workspace is None:
            return
        WorkspaceMember.objects.get_or_create(
            workspace=workspace, member=user, defaults={"role": role, "is_active": True}
        )
        for project in Project.objects.filter(workspace=workspace, archived_at__isnull=True):
            ProjectMember.objects.get_or_create(
                project=project, member=user, defaults={"role": role, "is_active": True}
            )
        Profile.objects.filter(user=user).update(last_workspace_id=workspace.id)
