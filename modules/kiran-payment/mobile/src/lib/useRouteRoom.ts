import { useEffect } from 'react';
import { useChat } from '@/lib/chat-store';

/**
 * Make the room in the URL the store's active room, and keep it that way.
 *
 * The URL is the authority on this screen: a tapped notification cold-starts
 * the app at `/chats/<room>`, and that is the room the person expects to see.
 *
 * Setting it once on mount is not enough. React runs a child's effects before
 * its parent's, so this screen switches the room *first* — and then
 * `ChatProvider` restores the saved workspace, whose `activeRoomId` is
 * whatever room was open last session. Both updates land in one render, and
 * when the saved room happens to equal the store's initial default the active
 * room appears never to have changed, so an effect keyed only on it does not
 * run again. Keying on `storageReady` as well re-asserts the route's room once
 * the restore has finished.
 *
 * Returns true once the active room is the route's room. Until then the
 * store's messages, members and title belong to some other room, and a screen
 * must not render them as though they were this one's.
 */
export function useRouteRoom(roomId: string | undefined): boolean {
  const { activeRoomId, setActiveRoom, storageReady, rooms } = useChat();
  const exists = !!roomId && rooms.some((room) => room.id === roomId);

  useEffect(() => {
    if (exists && roomId !== activeRoomId) setActiveRoom(roomId!);
  }, [exists, roomId, activeRoomId, setActiveRoom, storageReady]);

  return exists && activeRoomId === roomId;
}
