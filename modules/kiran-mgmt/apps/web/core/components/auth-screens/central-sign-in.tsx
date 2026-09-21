/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
// helpers
import type { EAuthModes } from "@/helpers/authentication.helper";
// local
import { AuthBase } from "./auth-base";

/**
 * KCMS is opened from the Central launcher by someone who has already signed in there, so
 * the front page hands straight over to Central instead of asking for a second password.
 *
 * The server sends the browser back with `?local=1` when Central sign-in is not configured
 * or fails, which is also how an administrator reaches the built-in form on purpose.
 */
export function CentralSignIn({ authType }: { authType: EAuthModes }) {
  const searchParams = useSearchParams();
  const useLocalForm = searchParams.has("local") || searchParams.has("error_code");
  const nextPath = searchParams.get("next_path");

  useEffect(() => {
    if (useLocalForm) return;
    const query = nextPath ? `?next_path=${encodeURIComponent(nextPath)}` : "";
    window.location.replace(`/auth/central/${query}`);
  }, [useLocalForm, nextPath]);

  if (useLocalForm) return <AuthBase authType={authType} />;

  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface-1">
      <LogoSpinner />
    </div>
  );
}
