/**
 * Binds the slash-command registry to the live store, so commands, the command
 * palette and the composer all execute through one implementation.
 */

import { useMemo } from "react";
import { toast } from "sonner";
import { useChat } from "./chat-store";
import type { SlashActions } from "./slash-commands";
import { pactApi } from "@/modules/pact/api";

export interface SlashActionOverrides {
  openInvite?: () => void;
  openShortcuts?: () => void;
}

export function useSlashActions(overrides: SlashActionOverrides = {}): SlashActions {
  const {
    sendMessage,
    askAgent,
    summarizeRoom,
    setRoomTopic,
    renameRoom,
    leaveRoom,
    setArchived,
    toggleRoomNotifications,
  } = useChat();

  const { openInvite, openShortcuts } = overrides;

  return useMemo<SlashActions>(
    () => ({
      sendMessage: (roomId, text) => sendMessage(roomId, text),
      askAgent: (roomId, prompt) => void askAgent(roomId, prompt),
      summarizeRoom: (roomId) => void summarizeRoom(roomId),
      setTopic: (roomId, topic) => setRoomTopic(roomId, topic),
      renameRoom: (roomId, name) => renameRoom(roomId, name),
      leaveRoom: (roomId) => leaveRoom(roomId),
      archiveRoom: (roomId) => setArchived(roomId, true),
      toggleNotifications: (roomId) => toggleRoomNotifications(roomId),
      openInvite: () => openInvite?.(),
      openShortcuts: () => openShortcuts?.(),
      notifyInfo: (text) => toast.info(text),
      pact: (roomId, args) => {
        void (async () => {
          const [command, ...rest] = args.trim().split(/\s+/);
          const value = rest.join(" ");
          try {
            if (!command || command === "status") {
              const status = await pactApi.status();
              sendMessage(
                roomId,
                `PACT Automation: ${status.worker_alive ? "online" : "offline"}; ${status.busy ? `busy with entry #${status.current}` : "idle"}. Profile: ${status.settings?.profile ?? "unknown"}. Dry run: ${status.settings?.dry_run ? "on" : "off"}.`,
              );
              return;
            }
            if (command === "list") {
              const entries = await pactApi.entries();
              const summary = entries.length
                ? entries.map((entry) => `#${entry.id} ${entry.status}`).join(", ")
                : "No PACT entries.";
              sendMessage(roomId, `PACT queue: ${summary}`);
              return;
            }
            const id = Number(value.trim().replace(/^#/, ''));
            if ((command === "approve" || command === "reject") && Number.isInteger(id)) {
              if (!window.confirm(`${command === "approve" ? "Approve" : "Reject"} PACT entry #${id}?`)) return;
              const entry = command === "approve" ? await pactApi.approve(id) : await pactApi.reject(id);
              sendMessage(roomId, `PACT entry #${entry.id} is now ${entry.status}.`);
              return;
            }
            if (command === "log" && Number.isInteger(id)) {
              const result = await pactApi.log(id);
              const logText = typeof result.log === "string" ? result.log : (result.log as unknown as string[] | undefined)?.join("\n") ?? "";
              sendMessage(roomId, `PACT log for #${id}:\n${logText || "No log entries."}`);
              return;
            }
            if (command === "add" && value.trim()) {
              if (!window.confirm("Queue this record in PACT Automation?")) return;
              let record: Record<string, unknown>;
              const trimmed = value.trim();
              if (trimmed.startsWith("{")) {
                record = JSON.parse(trimmed) as Record<string, unknown>;
              } else {
                const m = trimmed.match(/(?:customer\s+)?(.+?)\s+in\s+([A-Za-z\s]+?)\s+with\s+(?:phone|mobile|contact|tel)\s+([+\d\s-]+)/i);
                if (m) {
                  record = { Customer: m[1].trim(), City: m[2].trim(), Phone: m[3].trim() };
                } else {
                  record = { Customer: trimmed };
                }
              }
              const entry = await pactApi.add(record);
              sendMessage(roomId, `PACT entry #${entry.id} created and is waiting for approval.`);
              return;
            }
            toast.info("Use /pact status, list, add {JSON}, approve ID, reject ID, or log ID.");
          } catch (error) {
            sendMessage(roomId, `PACT error: ${error instanceof Error ? error.message : "request failed"}`);
          }
        })();
      },
    }),
    [
      sendMessage,
      askAgent,
      summarizeRoom,
      setRoomTopic,
      renameRoom,
      leaveRoom,
      setArchived,
      toggleRoomNotifications,
      openInvite,
      openShortcuts,
    ],
  );
}
