import { useEffect, useLayoutEffect } from "react";

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * The app is server-rendered, and React warns when a layout effect is used in
 * a component it renders on the server. Layout effects still matter on the
 * client — reading back DOM state before the browser paints is what keeps a
 * fix like the composer's pre-hydration adoption free of a visible flicker.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
