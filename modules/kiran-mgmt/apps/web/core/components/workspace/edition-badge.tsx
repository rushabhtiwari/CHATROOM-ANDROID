/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// ui
import { Tooltip } from "@plane/propel/tooltip";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
import packageJson from "package.json";

/**
 * The build stamp at the foot of the sidebar.
 *
 * Upstream shows its edition name here ("Community") as a button that opens a
 * paid-plan upgrade dialog. KCMS is one product with no plans to sell, so this is
 * a label, not a button.
 */
export const WorkspaceEditionBadge = observer(function WorkspaceEditionBadge() {
  const { isMobile } = usePlatformOS();

  return (
    <Tooltip tooltipContent="Kiran Cable Management System" isMobile={isMobile}>
      <span className="cursor-default rounded-md bg-layer-1 px-2.5 py-1.5 text-12 font-medium text-tertiary select-none">
        KCMS v{packageJson.version}
      </span>
    </Tooltip>
  );
});
