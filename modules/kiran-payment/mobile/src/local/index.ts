/**
 * Start the in-app server for a standalone build (see core.ts).
 *
 * Every route the backend served that the app calls, gathered in one place:
 * claims and receipts, the assistant, Meet, and the calendar. Chat needs no
 * route — a standalone build gives the chat store its local log instead (see
 * main.tsx). Outside calls go through Capacitor's native HTTP on a device,
 * because OpenAI's and Google's endpoints are not built to be called from a
 * web page's origin.
 */
import { CapacitorHttp } from '@capacitor/core';
import { isNative } from '~/native/platform';
import { installLocalServer, useNativeHttp } from './core';
import { rtsRoutes, rtsStreams } from './rts';
import { agentRoutes } from './agent';
import { meetRoutes } from './meet';
import { calendarRoutes } from './calendar';

export function startLocalServer(): () => void {
  if (isNative) {
    useNativeHttp(async ({ url, method, headers, data }) => {
      const response = await CapacitorHttp.request({ url, method, headers, data });
      return { status: response.status, data: response.data };
    });
  }
  return installLocalServer([...rtsRoutes, ...agentRoutes, ...meetRoutes, ...calendarRoutes], {
    ...rtsStreams,
  });
}
