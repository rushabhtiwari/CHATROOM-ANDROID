/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ArrowLeft } from "lucide-react";

// The Central launcher this app is opened from. Set at build time for another host.
const PORTAL_URL = process.env.VITE_CENTRAL_PORTAL_URL || "http://localhost:3000";

/**
 * The foot of the sidebar.
 *
 * Upstream shows its edition name here ("Community") as a button that opens a paid-plan
 * upgrade dialog. KCMS is one app inside the Central Platform, so this is the way back to
 * the launcher, the same link every other Kiran app keeps in this spot.
 */
export const WorkspaceEditionBadge = observer(function WorkspaceEditionBadge() {
  return (
    <a
      href={PORTAL_URL}
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-13 font-medium text-tertiary hover:bg-layer-transparent-hover hover:text-primary"
    >
      <ArrowLeft className="size-4" />
      All apps
    </a>
  );
});
