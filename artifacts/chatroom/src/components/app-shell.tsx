import { ReactNode, useEffect, useRef } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { Show, useAuth, useClerk, useUser } from "@clerk/react";
import { MessageSquare, Inbox, Sparkles, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  useGetUnreadDmCount,
  getGetUnreadDmCountQueryKey,
  useRecordLogin,
  useRecordLogout,
} from "@workspace/api-client-react";
import { useChatSocket } from "@/hooks/use-chat-socket";

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  active: boolean;
  badge?: number;
}

function NavItem({ href, icon, label, active, badge }: NavItemProps) {
  return (
    <Link href={href}>
      <button
        className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
        title={label}
        aria-label={label}
      >
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-sidebar">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </Link>
  );
}

interface AppShellProps {
  children: ReactNode;
  active: "lounge" | "dms" | "status";
}

export function AppShell({ children, active }: AppShellProps) {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isSignedIn } = useAuth();

  useChatSocket();

  const { data: unread } = useGetUnreadDmCount({
    query: {
      queryKey: getGetUnreadDmCountQueryKey(),
      refetchInterval: 60000,
    },
  });

  const recordLogin = useRecordLogin();
  const recordLogout = useRecordLogout();

  const loggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (isSignedIn && user?.id && loggedRef.current !== user.id) {
      loggedRef.current = user.id;
      recordLogin.mutate();
    }
  }, [isSignedIn, user?.id, recordLogin]);

  const handleSignOut = async () => {
    try {
      await recordLogout.mutateAsync();
    } catch {
      // best effort — proceed with sign out regardless
    }
    await signOut();
    setLocation("/");
  };

  return (
    <>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
      <Show when="signed-in">
        <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
          <nav className="w-16 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 shrink-0">
            <Link href="/lounge">
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-sm mb-6 cursor-pointer">
                <MessageSquare size={18} strokeWidth={2.5} />
              </div>
            </Link>
            <div className="flex flex-col gap-2">
              <NavItem
                href="/lounge"
                icon={<MessageSquare size={20} />}
                label="Lounge"
                active={active === "lounge"}
              />
              <NavItem
                href="/dms"
                icon={<Inbox size={20} />}
                label="Direct messages"
                active={active === "dms"}
                badge={unread?.total ?? 0}
              />
              <NavItem
                href="/status"
                icon={<Sparkles size={20} />}
                label="Status"
                active={active === "status"}
              />
            </div>
            <div className="mt-auto flex flex-col items-center gap-2">
              <Avatar className="w-9 h-9 border border-border">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {user?.firstName?.substring(0, 1)}
                  {user?.lastName?.substring(0, 1)}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={handleSignOut}
                title="Sign out"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </nav>
          <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
        </div>
      </Show>
    </>
  );
}
