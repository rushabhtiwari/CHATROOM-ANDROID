import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useChat } from '@/lib/chat-store';
import { TabBar } from '~/components/TabBar';
import { ChatListScreen } from '~/screens/chat/ChatListScreen';
import { ConversationScreen } from '~/screens/chat/ConversationScreen';
import { ThreadScreen } from '~/screens/chat/ThreadScreen';
import { MeetingFlowScreen } from '~/screens/chat/MeetingFlowScreen';
import { OrdersScreen } from '~/screens/orders/OrdersScreen';
import { OrderDetailScreen } from '~/screens/orders/OrderDetailScreen';
import { DispatchesScreen } from '~/screens/orders/DispatchesScreen';
import { DispatchDetailScreen } from '~/screens/orders/DispatchDetailScreen';
import { MeScreen } from '~/screens/MeScreen';
import { watchConnectivity } from '~/native/network';
import { initPush, type Destination } from '~/native/push';
import { hideSplash } from '~/native/shell';

/**
 * Bind the chat store's `online` flag to the device.
 *
 * In the console that flag is a developer switch over a simulated transport.
 * Here it is the radio, which means the outbox and the retry queue stop being
 * a demonstration of a mechanism and start being the mechanism.
 */
function useDeviceConnectivity() {
  const { setOnline } = useChat();
  useEffect(() => {
    let dispose: (() => void) | undefined;
    void watchConnectivity(setOnline).then((off) => {
      dispose = off;
    });
    return () => dispose?.();
  }, [setOnline]);
}

/** Turn a tapped notification into a screen. */
function usePushRouting() {
  const navigate = useNavigate();
  useEffect(() => {
    const route = (destination: Destination) => {
      if (destination.kind === 'room') navigate(`/chats/${destination.roomId}`);
      if (destination.kind === 'dispatch') navigate(`/dispatches/${destination.dispatchId}`);
      if (destination.kind === 'order') navigate(`/orders/${destination.orderId}`);
    };

    void initPush({
      onToken: (token) => {
        // Nowhere to send this yet: registering a device against a user is
        // sub-project #2's work, and inventing an endpoint for it here would
        // be a call that silently fails forever.
        console.info('APNs token acquired', token.slice(0, 12), '…');
      },
      onTap: route,
    });
  }, [navigate]);
}

export default function App() {
  useDeviceConnectivity();
  usePushRouting();

  useEffect(() => {
    hideSplash();
  }, []);

  return (
    <div className="relative h-full overflow-hidden bg-canvas">
      <Routes>
        <Route path="/" element={<Navigate to="/chats" replace />} />
        <Route path="/chats" element={<ChatListScreen />} />
        <Route path="/chats/:roomId" element={<ConversationScreen />} />
        <Route path="/chats/:roomId/schedule" element={<MeetingFlowScreen />} />
        <Route path="/chats/:roomId/thread/:rootId" element={<ThreadScreen />} />
        <Route path="/orders" element={<OrdersScreen />} />
        <Route path="/orders/:orderId" element={<OrderDetailScreen />} />
        <Route path="/dispatches" element={<DispatchesScreen />} />
        <Route path="/dispatches/:dispatchId" element={<DispatchDetailScreen />} />
        <Route path="/me" element={<MeScreen />} />
        <Route path="*" element={<Navigate to="/chats" replace />} />
      </Routes>
      <TabBar />
    </div>
  );
}
