import { useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Sparkles, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  useListStatuses,
  useCreateStatus,
  getListStatusesQueryKey,
} from "@workspace/api-client-react";

const MAX = 280;

function initials(name: string): string {
  return name.substring(0, 2).toUpperCase();
}

function StatusContent() {
  const { user } = useUser();
  const myId = user?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: statuses = [], isLoading } = useListStatuses({
    query: {
      queryKey: getListStatusesQueryKey(),
      refetchInterval: 30000,
    },
  });

  const createStatus = useCreateStatus();

  const handlePost = async () => {
    const text = body.trim();
    if (!text) return;
    try {
      await createStatus.mutateAsync({ data: { body: text } });
      setBody("");
      queryClient.invalidateQueries({ queryKey: getListStatusesQueryKey() });
      toast({ title: "Status posted", description: "It will be visible for 24 hours." });
    } catch {
      toast({
        title: "Could not post status",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const remaining = MAX - body.length;
  const myStatus = statuses.find((s) => s.userId === myId);
  const others = statuses.filter((s) => s.userId !== myId);

  return (
    <main className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
      <header className="h-16 border-b border-border flex items-center gap-3 px-4 md:px-6 shrink-0">
        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
          <Sparkles size={16} strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-serif font-bold text-lg leading-tight">Status</div>
          <div className="text-[11px] text-muted-foreground">
            Share what you're up to · disappears after 24 hours
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
          <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {user?.firstName?.substring(0, 1)}
                  {user?.lastName?.substring(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <Textarea
                  value={body}
                  onChange={(e) =>
                    setBody(e.target.value.slice(0, MAX))
                  }
                  placeholder="What's on your mind?"
                  className="min-h-[80px] resize-none border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent text-[15px]"
                  rows={2}
                />
                <div className="flex items-center justify-between mt-2">
                  <span
                    className={`text-xs ${
                      remaining < 20
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {remaining} characters left
                  </span>
                  <Button
                    size="sm"
                    onClick={handlePost}
                    disabled={!body.trim() || createStatus.isPending}
                    className="rounded-xl gap-1.5"
                  >
                    <Send size={14} />
                    {createStatus.isPending ? "Posting..." : "Post status"}
                  </Button>
                </div>
              </div>
            </div>
            {myStatus && (
              <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-xs text-muted-foreground">
                <span className="font-medium">Your active status:</span>
                <span className="flex-1 italic">"{myStatus.body}"</span>
                <span className="shrink-0">
                  {formatDistanceToNow(new Date(myStatus.expiresAt), {
                    addSuffix: false,
                  })}{" "}
                  left
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Active statuses
            </h2>
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-12">
                Loading statuses...
              </div>
            ) : others.length === 0 && !myStatus ? (
              <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
                <div className="w-12 h-12 mx-auto bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-3">
                  <Sparkles size={20} />
                </div>
                <h3 className="font-serif font-bold mb-1">No statuses yet</h3>
                <p className="text-sm text-muted-foreground">
                  Be the first to share what you're up to.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {others.map((s) => (
                  <div
                    key={s.id}
                    className="bg-card border border-card-border rounded-2xl p-4 shadow-sm flex items-start gap-3"
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={s.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                        {initials(s.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {s.username}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(s.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="text-[15px] mt-1 whitespace-pre-wrap break-words leading-relaxed">
                        {s.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </main>
  );
}

export function Status() {
  return (
    <AppShell active="status">
      <StatusContent />
    </AppShell>
  );
}
