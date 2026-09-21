# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
import os

from django.views import View
from django.contrib.auth import logout
from django.http import HttpResponseRedirect
from django.utils import timezone

# Module imports
from plane.authentication.utils.host import user_ip, base_host
from plane.db.models import User


class SignOutAuthEndpoint(View):
    def post(self, request):
        # Get user
        try:
            user = User.objects.get(pk=request.user.id)
            user.last_logout_ip = user_ip(request=request)
            user.last_logout_time = timezone.now()
            user.save()
            # Log the user out
            logout(request)
            return HttpResponseRedirect(self._after(request))
        except Exception:
            return HttpResponseRedirect(self._after(request))

    @staticmethod
    def _after(request):
        # Under Central single sign-on the app's own front page signs the person straight
        # back in, so signing out returns them to the launcher instead.
        return os.environ.get("CENTRAL_PORTAL_URL") or base_host(request=request, is_app=True)
