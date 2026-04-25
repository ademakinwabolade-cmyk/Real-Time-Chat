import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { format, isSameDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Users, Activity, MessageSquare, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  useListMessages,
  useCreateMessage,
  useGetChatStats,
  useGetPresence,
  getListMessagesQueryKey,
  getGetChatStatsQueryKey,
  getGetPresenceQueryKey,
} from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react";

function MessageGroup({ messages, currentUserId }: { messages: Message[], currentUserId?: string }) {
  if (messages.length === 0) return null;
  const firstMsg = messages[0];
  const isMe = firstMsg.userId === currentUserId;

  return (
    <div className={`flex gap-3 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : ""}`}>
      {!isMe && (
        <Avatar className="w-8 h-8 mt-1 shrink-0">
          <AvatarImage src={firstMsg.avatarUrl || undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {firstMsg.username.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground/90">{firstMsg.username}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(firstMsg.createdAt), "h:mm a")}</span>
          </div>
        )}
        <div className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`px-4 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                isMe 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-card text-card-foreground border border-card-border rounded-tl-sm"
              }`}
            >
              {msg.body}
            </div>
          ))}
        </div>
        {isMe && (
          <span className="text-xs text-muted-foreground mt-1 px-1">
            {format(new Date(messages[messages.length - 1].createdAt), "h:mm a")}
          </span>
        )}
      </div>
    </div>
  );
}

function LoungeContent() {
  const { user } = useUser();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: messages = [], isLoading: loadingMessages } = useListMessages(undefined, { 
    query: { queryKey: getListMessagesQueryKey() } 
  });
  
  const { data: stats } = useGetChatStats({
    query: { queryKey: getGetChatStatsQueryKey(), refetchInterval: 30000 },
  });

  const { data: presence } = useGetPresence({
    query: { queryKey: getGetPresenceQueryKey(), refetchInterval: 10000 },
  });

  const createMessage = useCreateMessage();

  // State
  const [draft, setDraft] = useState("");
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Group messages
  const groupedMessages = useMemo(() => {
    const groups: { date: Date, messages: Message[][] }[] = [];
    if (!messages.length) return groups;

    let currentDate = new Date(messages[0].createdAt);
    let currentDayGroup: Message[][] = [];
    let currentAuthorGroup: Message[] = [messages[0]];

    for (let i = 1; i < messages.length; i++) {
      const msg = messages[i];
      const msgDate = new Date(msg.createdAt);
      const prevMsg = messages[i - 1];

      // If different day, push current day group
      if (!isSameDay(currentDate, msgDate)) {
        if (currentAuthorGroup.length > 0) currentDayGroup.push(currentAuthorGroup);
        if (currentDayGroup.length > 0) groups.push({ date: currentDate, messages: currentDayGroup });
        
        currentDate = msgDate;
        currentDayGroup = [];
        currentAuthorGroup = [msg];
      } 
      // If same author and within 5 minutes, group together
      else if (msg.userId === prevMsg.userId && msgDate.getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000) {
        currentAuthorGroup.push(msg);
      } 
      // New author or gap in time
      else {
        if (currentAuthorGroup.length > 0) currentDayGroup.push(currentAuthorGroup);
        currentAuthorGroup = [msg];
      }
    }

    if (currentAuthorGroup.length > 0) currentDayGroup.push(currentAuthorGroup);
    if (currentDayGroup.length > 0) groups.push({ date: currentDate, messages: currentDayGroup });

    return groups;
  }, [messages]);

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: smooth ? "smooth" : "auto"
        });
      }
    }
  };

  useEffect(() => {
    if (!isScrolledUp) {
      scrollToBottom(false);
    }
  }, [messages.length]); // only smooth scroll if we're not manually scrolling up

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsScrolledUp(!isNearBottom);
  };

  const handleSend = async () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    
    try {
      await createMessage.mutateAsync({ data: { body: text } });
      scrollToBottom();
    } catch (err) {
      toast({
        title: "Failed to send",
        description: "Your message could not be sent.",
        variant: "destructive"
      });
      setDraft(text); // restore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      {/* Sidebar - Stats & Presence */}
      <aside className="w-72 border-r border-sidebar-border bg-sidebar hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
              <MessageSquare size={16} strokeWidth={2.5} />
            </div>
            <span className="font-serif font-bold text-lg">Lounge</span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* Presence */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Online Now
                </h3>
                <span className="text-xs bg-sidebar-accent px-2 py-0.5 rounded-full text-sidebar-accent-foreground font-medium">
                  {presence?.onlineCount || 0}
                </span>
              </div>
              <div className="space-y-1">
                {presence?.members.map(member => {
                  const isMe = member.userId === user?.id;
                  const row = (
                    <div className="flex items-center gap-2 group">
                      <Avatar className="w-6 h-6 border border-background">
                        <AvatarImage src={member.avatarUrl || undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {member.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate text-sidebar-foreground/90 font-medium flex-1">
                        {member.username} {isMe && <span className="text-muted-foreground font-normal">(you)</span>}
                      </span>
                    </div>
                  );
                  if (isMe) {
                    return (
                      <div key={member.userId} className="px-2 py-1 rounded-md">
                        {row}
                      </div>
                    );
                  }
                  return (
                    <Link key={member.userId} href={`/dms/${member.userId}`}>
                      <button className="w-full text-left px-2 py-1 rounded-md hover:bg-sidebar-accent transition-colors" title={`Message ${member.username}`}>
                        {row}
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity size={14} /> Today's Activity
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-sidebar-accent/50 p-3 rounded-xl border border-sidebar-border">
                  <div className="text-2xl font-bold text-sidebar-foreground">{stats?.messagesToday || 0}</div>
                  <div className="text-xs text-muted-foreground font-medium">Messages</div>
                </div>
                <div className="bg-sidebar-accent/50 p-3 rounded-xl border border-sidebar-border">
                  <div className="text-2xl font-bold text-sidebar-foreground">{stats?.activeMembersToday || 0}</div>
                  <div className="text-xs text-muted-foreground font-medium">Members</div>
                </div>
              </div>
            </div>

            {/* Top Contributors */}
            {stats?.topContributors && stats.topContributors.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users size={14} /> Top Voices
                </h3>
                <div className="space-y-2">
                  {stats.topContributors.map(contributor => (
                    <div key={contributor.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Avatar className="w-5 h-5 shrink-0">
                          <AvatarImage src={contributor.avatarUrl || undefined} />
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {contributor.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate text-sidebar-foreground/80">{contributor.username}</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{contributor.messageCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-sidebar-border mt-auto">
          <div className="flex items-center gap-2 overflow-hidden">
            <Avatar className="w-8 h-8 border border-border">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {user?.firstName?.substring(0, 1)}{user?.lastName?.substring(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold truncate leading-none">{user?.fullName || user?.username}</span>
              <span className="text-[11px] text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        <header className="h-16 border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0 md:hidden">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
              <MessageSquare size={16} strokeWidth={2.5} />
            </div>
            <span className="font-serif font-bold text-lg">Lounge</span>
          </div>
          <span className="text-xs bg-accent px-2 py-1 rounded-full text-accent-foreground font-medium flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
            </span>
            {presence?.onlineCount || 0}
          </span>
        </header>

        <ScrollArea 
          ref={scrollRef}
          className="flex-1 px-4 md:px-6"
          onScrollCapture={handleScroll}
        >
          <div className="py-6 flex flex-col gap-6 min-h-full justify-end">
            {loadingMessages && messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-2 text-muted-foreground">
                  <MessageSquare size={24} className="opacity-50" />
                  <span className="text-sm font-medium">Loading history...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto my-12">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                  <MessageSquare size={32} />
                </div>
                <h2 className="text-xl font-serif font-bold mb-2">It's quiet here.</h2>
                <p className="text-muted-foreground">You're the first one here. Send a message to get the conversation started.</p>
              </div>
            ) : (
              groupedMessages.map((group, i) => (
                <div key={group.date.toISOString()} className="space-y-6">
                  <div className="flex items-center justify-center my-6">
                    <div className="bg-accent/50 text-accent-foreground text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                      {isSameDay(group.date, new Date()) 
                        ? "Today" 
                        : format(group.date, "EEEE, MMMM d")}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {group.messages.map((authorGroup, j) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        key={authorGroup[0].id}
                      >
                        <MessageGroup 
                          messages={authorGroup} 
                          currentUserId={user?.id} 
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Scroll to bottom pill */}
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
          <div className="max-w-4xl mx-auto relative bg-card border border-input rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-all">
            <Textarea 
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[60px] max-h-[200px] w-full resize-none border-0 shadow-none focus-visible:ring-0 py-4 px-4 pr-14 bg-transparent text-[15px]"
              rows={1}
            />
            <Button 
              size="icon" 
              onClick={handleSend}
              disabled={!draft.trim() || createMessage.isPending}
              className="absolute right-2 bottom-2 h-8 w-8 rounded-xl transition-transform active:scale-95"
            >
              <Send size={14} className={createMessage.isPending ? "opacity-0" : "opacity-100"} />
              {createMessage.isPending && <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" /></div>}
            </Button>
          </div>
          <div className="max-w-4xl mx-auto mt-2 text-center">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              <strong>Enter</strong> to send · <strong>Shift+Enter</strong> for newline
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

export function Lounge() {
  return (
    <AppShell active="lounge">
      <LoungeContent />
    </AppShell>
  );
}