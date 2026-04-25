import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { formatDistanceToNow } from "date-fns";
import { Search, MessageSquarePlus, Inbox, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useListConversations,
  useListUsers,
  getListConversationsQueryKey,
  getListUsersQueryKey,
} from "@workspace/api-client-react";

function initials(name: string): string {
  return name.substring(0, 2).toUpperCase();
}

function NewConversationDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const params = query.trim() ? { search: query.trim() } : undefined;
  const { data: users = [], isLoading } = useListUsers(params, {
    query: {
      queryKey: getListUsersQueryKey(params),
      enabled: open,
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full gap-1 shadow-sm">
          <MessageSquarePlus size={14} /> New
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Start a conversation</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            className="pl-9"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="space-y-1 pr-2">
            {isLoading && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Loading members...
              </div>
            )}
            {!isLoading && users.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No members found.
              </div>
            )}
            {users.map((u) => (
              <Link key={u.userId} href={`/dms/${u.userId}`}>
                <button
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={u.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {initials(u.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {u.username}
                    </div>
                  </div>
                </button>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function Conversations() {
  const { user } = useUser();
  const myId = user?.id;
  const [filter, setFilter] = useState("");

  const { data: conversations = [], isLoading } = useListConversations({
    query: {
      queryKey: getListConversationsQueryKey(),
      refetchInterval: 30000,
    },
  });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      c.partner.username.toLowerCase().includes(q),
    );
  }, [conversations, filter]);

  return (
    <AppShell active="dms">
      <div className="flex h-full">
        <main className="flex-1 flex flex-col bg-background min-w-0">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                <Inbox size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="font-serif font-bold text-lg leading-tight truncate">
                  Direct Messages
                </h1>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Lock size={10} /> Private — only you and the recipient see them
                </p>
              </div>
            </div>
            <NewConversationDialog />
          </header>

          <div className="px-6 py-3 border-b border-border bg-background/80 backdrop-blur shrink-0">
            <div className="relative max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search conversations"
                className="pl-9 h-10 rounded-full bg-card border-input"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">
                Loading conversations...
              </div>
            ) : visible.length === 0 ? (
              <div className="p-12 text-center max-w-sm mx-auto">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Inbox size={28} />
                </div>
                <h2 className="font-serif font-bold text-xl mb-2">
                  No conversations yet
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Start a private chat with someone from the lounge. Tap "New" above to find a member.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visible.map((conv) => {
                  const last = conv.lastMessage;
                  const sentByMe = last.senderId === myId;
                  const preview = sentByMe
                    ? `You: ${last.body}`
                    : last.body;
                  return (
                    <Link
                      key={conv.partner.userId}
                      href={`/dms/${conv.partner.userId}`}
                    >
                      <button className="w-full text-left flex items-center gap-3 px-6 py-4 hover:bg-accent/40 transition-colors">
                        <Avatar className="w-12 h-12 shrink-0">
                          <AvatarImage
                            src={conv.partner.avatarUrl ?? undefined}
                          />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {initials(conv.partner.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold truncate">
                              {conv.partner.username}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {formatDistanceToNow(new Date(last.createdAt), {
                                addSuffix: false,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p
                              className={`text-sm truncate ${
                                conv.unreadCount > 0 && !sentByMe
                                  ? "text-foreground font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {preview}
                            </p>
                            {conv.unreadCount > 0 && !sentByMe && (
                              <span className="min-w-[20px] h-5 px-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                                {conv.unreadCount > 99
                                  ? "99+"
                                  : conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </Link>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </main>
      </div>
    </AppShell>
  );
}
