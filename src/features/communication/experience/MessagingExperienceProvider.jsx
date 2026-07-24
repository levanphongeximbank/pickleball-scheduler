import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MESSAGING_TAB,
  MESSAGING_EXPERIENCE_PHASE,
} from "./constants.js";
import { createDemoMessagingExperienceGateway } from "./createDemoMessagingExperienceGateway.js";
import { MessagingExperienceContext } from "./messagingExperienceContext.js";

/**
 * @param {{
 *   gateway?: object,
 *   allowDemoFallback?: boolean,
 *   children: import("react").ReactNode,
 * }} props
 */
export function MessagingExperienceProvider({
  gateway: injectedGateway,
  allowDemoFallback = true,
  children,
}) {
  const gateway = useMemo(() => {
    if (injectedGateway) return injectedGateway;
    // COMMS-07: Production / UNAVAILABLE paths must not invent demo data.
    if (allowDemoFallback === false) {
      throw new Error(
        "MessagingExperienceProvider requires an injected gateway when allowDemoFallback is false"
      );
    }
    return createDemoMessagingExperienceGateway();
  }, [injectedGateway, allowDemoFallback]);

  const [tab, setTab] = useState(MESSAGING_TAB.DIRECT);
  const [list, setList] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [details, setDetails] = useState(null);
  const [unread, setUnread] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [listStatus, setListStatus] = useState("idle");
  const [threadStatus, setThreadStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [composerError, setComposerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [slowMode, setSlowMode] = useState(null);
  const [mobileView, setMobileView] = useState("list"); // list | thread | details
  const loadGeneration = useRef(0);
  const activeIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const scopeForTab = tab === MESSAGING_TAB.CLUB
    ? "CLUB"
    : tab === MESSAGING_TAB.COMMUNITY
      ? "COMMUNITY"
      : "DIRECT";

  const refreshUnread = useCallback(async () => {
    const badge = await gateway.getUnreadBadge();
    setUnread(badge);
  }, [gateway]);

  const refreshList = useCallback(async () => {
    setListStatus("loading");
    setError(null);
    try {
      if (tab === MESSAGING_TAB.REQUESTS) {
        const rows = await gateway.listDirectRequests();
        setRequests(rows);
        setList(rows);
      } else if (tab === MESSAGING_TAB.CLUB) {
        setList(await gateway.listClubChannels());
      } else if (tab === MESSAGING_TAB.COMMUNITY) {
        setList(await gateway.listCommunityChannels());
      } else {
        setList(await gateway.listDirectConversations());
      }
      await refreshUnread();
      setListStatus("ready");
    } catch (err) {
      setListStatus("error");
      setError(err?.message || "Không tải được danh sách hội thoại");
    }
  }, [gateway, tab, refreshUnread]);

  const loadThread = useCallback(
    async (conversationId, scope) => {
      if (!conversationId) {
        setMessages([]);
        setDetails(null);
        setThreadStatus("idle");
        return;
      }
      const gen = ++loadGeneration.current;
      setThreadStatus("loading");
      setError(null);
      try {
        const [msgs, detail] = await Promise.all([
          gateway.loadMessages({ conversationId, scope }),
          gateway.getConversationDetails({ conversationId, scope }),
        ]);
        if (gen !== loadGeneration.current) return; // stale
        setMessages(msgs);
        setDetails(detail);
        let slow = null;
        if (scope === "COMMUNITY") {
          slow = await gateway.getSlowModeState({ conversationId });
        }
        if (gen !== loadGeneration.current) return;
        setSlowMode(slow);
        await gateway.markRead({
          conversationId,
          scope,
          lastReadMessageId: msgs[msgs.length - 1]?.messageId,
        });
        if (gen !== loadGeneration.current) return;
        setThreadStatus("ready");
        await refreshUnread();
      } catch (err) {
        if (gen !== loadGeneration.current) return;
        setThreadStatus("error");
        setError(err?.message || "Không tải được tin nhắn");
      }
    },
    [gateway, refreshUnread]
  );

  useEffect(() => {
    refreshList();
    setActiveId(null);
    setMessages([]);
    setDetails(null);
    setReplyTo(null);
    setMobileView("list");
  }, [tab, refreshList]);

  useEffect(() => {
    if (!activeId) return undefined;
    const scope = scopeForTab === "DIRECT" ? "DIRECT" : scopeForTab;
    let cancelled = false;
    let subscription = null;

    (async () => {
      await loadThread(activeId, scope);
      if (cancelled) return;
      subscription = await gateway.subscribe({
        conversationId: activeId,
        onSignal: () => {
          // Realtime is signal-only — reload authoritative state.
          if (activeIdRef.current === activeId) {
            loadThread(activeId, scope);
            refreshList();
          }
        },
      });
    })();

    return () => {
      cancelled = true;
      loadGeneration.current += 1;
      if (subscription) {
        subscription.unsubscribe();
      } else {
        gateway.unsubscribe({ conversationId: activeId });
      }
    };
  }, [activeId, scopeForTab, gateway, loadThread, refreshList]);

  const openConversation = useCallback((item) => {
    if (!item?.conversationId) return;
    setActiveId(item.conversationId);
    setReplyTo(null);
    setComposerError(null);
    setMobileView("thread");
  }, []);

  const sendMessage = useCallback(
    async (body) => {
      if (!activeId) return;
      setSubmitting(true);
      setComposerError(null);
      try {
        await gateway.sendMessage({
          conversationId: activeId,
          scope: scopeForTab === "DIRECT" ? "DIRECT" : scopeForTab,
          body,
          replyToMessageId: replyTo?.messageId,
        });
        setReplyTo(null);
        await loadThread(
          activeId,
          scopeForTab === "DIRECT" ? "DIRECT" : scopeForTab
        );
        await refreshList();
      } catch (err) {
        setComposerError(err?.message || "Gửi tin nhắn thất bại");
      } finally {
        setSubmitting(false);
      }
    },
    [activeId, gateway, replyTo, scopeForTab, loadThread, refreshList]
  );

  const value = useMemo(
    () => ({
      phase: MESSAGING_EXPERIENCE_PHASE,
      gateway,
      adapterInfo: gateway.getAdapterInfo(),
      viewer: gateway.getViewerContext(),
      tab,
      setTab,
      list,
      requests,
      activeId,
      messages,
      details,
      unread,
      replyTo,
      setReplyTo,
      listStatus,
      threadStatus,
      error,
      composerError,
      submitting,
      slowMode,
      mobileView,
      setMobileView,
      refreshList,
      openConversation,
      sendMessage,
      acceptRequest: async (requestId) => {
        await gateway.acceptDirectRequest({ requestId });
        await refreshList();
      },
      declineRequest: async (requestId) => {
        await gateway.declineDirectRequest({ requestId });
        await refreshList();
      },
      cancelRequest: async (requestId) => {
        await gateway.cancelDirectRequest({ requestId });
        await refreshList();
      },
      joinChannel: async (conversationId) => {
        await gateway.joinCommunityChannel({ conversationId });
        await refreshList();
        setActiveId(conversationId);
        setMobileView("thread");
      },
      leaveChannel: async (conversationId) => {
        await gateway.leaveCommunityChannel({ conversationId });
        await refreshList();
      },
      blockUser: async (counterpartParticipantId) => {
        await gateway.blockUser({ counterpartParticipantId });
        await refreshList();
      },
      reportMessage: async (messageId, reason) => {
        await gateway.reportMessage({
          conversationId: activeId,
          messageId,
          reason,
          scope: scopeForTab === "DIRECT" ? "DIRECT" : scopeForTab,
        });
      },
      pinMessage: async (messageId) => {
        await gateway.pinMessage({
          conversationId: activeId,
          messageId,
          scope: scopeForTab,
        });
        await loadThread(activeId, scopeForTab);
      },
      unpinMessage: async (messageId) => {
        await gateway.unpinMessage({
          conversationId: activeId,
          messageId,
          scope: scopeForTab,
        });
        await loadThread(activeId, scopeForTab);
      },
      hideMessage: async (messageId) => {
        await gateway.hideMessage({
          conversationId: activeId,
          messageId,
        });
        await loadThread(activeId, "COMMUNITY");
      },
      moderate: async (action, participantId) => {
        if (action === "suspend") {
          await gateway.suspendParticipant({
            conversationId: activeId,
            participantId,
          });
        } else if (action === "ban") {
          await gateway.banParticipant({
            conversationId: activeId,
            participantId,
          });
        } else if (action === "restore") {
          await gateway.restoreParticipant({
            conversationId: activeId,
            participantId,
          });
        }
        await loadThread(activeId, "COMMUNITY");
      },
      closeThread: () => {
        setActiveId(null);
        setMessages([]);
        setDetails(null);
        setMobileView("list");
      },
    }),
    [
      gateway,
      tab,
      list,
      requests,
      activeId,
      messages,
      details,
      unread,
      replyTo,
      listStatus,
      threadStatus,
      error,
      composerError,
      submitting,
      slowMode,
      mobileView,
      refreshList,
      openConversation,
      sendMessage,
      scopeForTab,
      loadThread,
    ]
  );

  return (
    <MessagingExperienceContext.Provider value={value}>
      {children}
    </MessagingExperienceContext.Provider>
  );
}
