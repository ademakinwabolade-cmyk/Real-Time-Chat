import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  ArrowLeft,
  Lock,
  CheckCheck,
  Check,
  ChevronDown,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  useGetUserProfile,
  useListDirectMessages,
  useSendDirectMessage,
  useSendVoiceMessage,
  useMarkConversationRead,
  getListDirectMessagesQueryKey,
  getListConversationsQueryKey,
  getGetUnreadDmCountQueryKey,
} from "@workspace/api-client-react";
import type { DirectMessage } from "@workspace/api-client-react";
import { VoiceRecorder } from "@/components/voice-recorder";
import { VoicePlayer } from "@/components/voice-player";

function initials(name: string): string {
  return name.substring(0, 2).toUpperCase();
}

interface BubbleProps {
  message: DirectMessage;
  isMine: boolean;
  showTail: boolean;
}

function Bubble({ message, isMine, showTail }: BubbleProps) {
  return (
    <div
      className={`max-w-[78%] flex flex-col ${
        isMine ? "self-end items-end" : "self-start items-start"
      }`}
    >
      <div
        className={`px-3.5 py-2 text-[15px] leading-relaxed shadow-sm ${
          isMine
            ? `bg-primary text-primary-foreground ${
                showTail ? "rounded-2xl rounded-br-md" : "rounded-2xl"
              }`
            : `bg-card border border-card-border text-card-foreground ${
                showTail ? "rounded-2xl rounded-bl-md" : "rounded-2xl"
              }`
        }`}
      >
        {message.voiceAudioId != null ? (
          <VoicePlayer
            audioId={message.voiceAudioId}
            durationMs={message.voiceDurationMs ?? 0}
            isMine={isMine}
          />
        ) : (
          <span className="whitespace-pre-wrap break-words">
            {message.body}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-[10px] text-muted-foreground font-medium">
          {format(new Date(message.createdAt), "h:mm a")}
        </span>
        {isMine &&
          (message.readAt ? (
            <CheckCheck size={12} className="text-primary" />
          ) : (
            <Check size={12} className="text-muted-foreground" />
          ))}
      </div>
    </div>
  );
}

function DmContent({ partnerId }: { partnerId: string }) {
  const { user } = useUser();
  const myId = user?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const { data: partner, isLoading: loadingPartner } = useGetUserProfile(
    partnerId,
  );
  const { data: messages = [], isLoading: loadingMessages } =
    useListDirectMessages(partnerId, {
      query: { queryKey: getListDirectMessagesQueryKey(partnerId) },
    });
  const sendDm = useSendDirectMessage();
  const sendVoice = useSendVoiceMessage();
  const markRead = useMarkConversationRead();

  const groups = useMemo(() => {
    const out: { date: Date; runs: DirectMessage[][] }[] = [];
    if (messages.length === 0) return out;
    let dayDate = new Date(messages[0].createdAt);
    let day: DirectMessage[][] = [];
    let run: DirectMessage[] = [messages[0]];
    for (let i = 1; i < messages.length; i++) {
      const m = messages[i];
      const prev = messages[i - 1];
      const mDate = new Date(m.createdAt);
      if (!isSameDay(dayDate, mDate)) {
        if (run.length) day.push(run);
        if (day.length) out.push({ date: dayDate, runs: day });
        dayDate = mDate;
        day = [];
        run = [m];
      } else if (
        m.senderId === prev.senderId &&
        mDate.getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000
      ) {
        run.push(m);
      } else {
        if (run.length) day.push(run);
        run = [m];
      }
    }
    if (run.length) day.push(run);
    if (day.length) out.push({ date: dayDate, runs: day });
    return out;
  }, [messages]);

  const scrollToBottom = (smooth = true) => {
    if (!scrollRef.current) return;
    const viewport = scrollRef.current.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (viewport) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  useEffect(() => {
    if (!isScrolledUp) scrollToBottom(false);
  }, [messages.length]);

  // Mark as read when there are unread messages from partner
  useEffect(() => {
    if (!myId) return;
    const hasUnread = messages.some(
      (m) => m.recipientId === myId && !m.readAt,
    );
    if (!hasUnread) return;
    markRead.mutate(
      { userId: partnerId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListConversationsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetUnreadDmCountQueryKey(),
          });
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, partnerId, myId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsScrolledUp(!nearBottom);
  };

  const handleSend = async () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    try {
      await sendDm.mutateAsync({ userId: partnerId, data: { body: text } });
      scrollToBottom(true);
    } catch {
      toast({
        title: "Failed to send",
        description: "Your message could not be delivered.",
        variant: "destructive",
      });
      setDraft(text);
    }
  };

  const handleSendVoice = async (params: {
    audioBase64: string;
    mimeType: string;
    durationMs: number;
  }) => {
    try {
      await sendVoice.mutateAsync({ userId: partnerId, data: params });
      scrollToBottom(true);
    } catch {
      toast({
        title: "Failed to send voice message",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-background min-w-0 relative">
      <header className="h-16 border-b border-border flex items-center gap-3 px-4 md:px-6 shrink-0">
        <Link href="/dms">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 -ml-2"
            title="Back"
          >
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <Avatar className="w-10 h-10">
          <AvatarImage src={partner?.avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {partner ? initials(partner.username) : "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate leading-tight">
            {loadingPartner ? "Loading..." : partner?.username ?? "Unknown"}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Lock size={10} /> Private conversation
          </div>
        </div>
      </header>

      <ScrollArea
        ref={scrollRef}
        className="flex-1 px-4 md:px-6"
        onScrollCapture={handleScroll}
      >
        <div className="py-6 flex flex-col gap-2 min-h-full justify-end">
          {loadingMessages && messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Loading conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto my-12">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                <Lock size={28} />
              </div>
              <h2 className="text-xl font-serif font-bold mb-2">
                Say hello to {partner?.username ?? "them"}
              </h2>
              <p className="text-muted-foreground text-sm">
                This is the start of your private conversation. Only the two of
                you can see these messages.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.date.toISOString()}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center justify-center my-3">
                  <div className="bg-accent/50 text-accent-foreground text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                    {isSameDay(group.date, new Date())
                      ? "Today"
                      : format(group.date, "EEEE, MMMM d")}
                  </div>
                </div>
                {group.runs.map((run) => {
                  const isMine = run[0].senderId === myId;
                  return (
                    <div
                      key={run[0].id}
                      className={`flex flex-col gap-0.5 ${
                        isMine ? "items-end" : "items-start"
                      }`}
                    >
                      {run.map((m, i) => (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex w-full ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <Bubble
                            message={m}
                            isMine={isMine}
                            showTail={i === run.length - 1}
                          />
                        </motion.div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <AnimatePresence>
        {isScrolledUp && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10"
          >
            <Button
              size="sm"
              className="rounded-full shadow-lg gap-1 border border-border"
              variant="secondary"
              onClick={() => scrollToBottom(true)}
            >
              <ChevronDown size={14} /> New messages
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 md:p-6 bg-background/80 backdrop-blur-md border-t border-border shrink-0">
        <div className="max-w-4xl mx-auto flex items-end gap-2">
          <div className="flex-1 relative bg-card border border-input rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-all">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                partner ? `Message ${partner.username}...` : "Message..."
              }
              className="min-h-[60px] max-h-[200px] w-full resize-none border-0 shadow-none focus-visible:ring-0 py-4 px-4 pr-14 bg-transparent text-[15px]"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!draft.trim() || sendDm.isPending}
              className="absolute right-2 bottom-2 h-8 w-8 rounded-xl transition-transform active:scale-95"
              title="Send"
            >
              <Send
                size={14}
                className={sendDm.isPending ? "opacity-0" : "opacity-100"}
              />
              {sendDm.isPending && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </Button>
          </div>
          <VoiceRecorder
            onSend={handleSendVoice}
            disabled={sendVoice.isPending}
          />
        </div>
        <div className="max-w-4xl mx-auto mt-2 text-center">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            <strong>Enter</strong> to send · <strong>Shift+Enter</strong> for newline · Tap mic to record
          </span>
        </div>
      </div>
    </main>
  );
}

export function DmThread() {
  const [, params] = useRoute<{ userId: string }>("/dms/:userId");
  const partnerId = params?.userId;

  return (
    <AppShell active="dms">
      {partnerId ? (
        <DmContent partnerId={partnerId} />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Conversation not found.
        </div>
      )}
    </AppShell>
  );
}
