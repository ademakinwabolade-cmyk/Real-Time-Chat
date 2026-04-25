import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient"; // Assume created or make one
import { HomeRedirect } from "@/pages/home";
import { Lounge } from "@/pages/lounge";
import { Conversations } from "@/pages/conversations";
import { DmThread } from "@/pages/dm-thread";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(13 65% 54%)",
    colorForeground: "hsl(20 14% 15%)",
    colorMutedForeground: "hsl(20 10% 45%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(40 30% 98%)",
    colorInput: "hsl(35 30% 95%)",
    colorInputForeground: "hsl(20 14% 15%)",
    colorNeutral: "hsl(30 15% 85%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-card border border-card-border shadow-md rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-serif font-bold text-2xl tracking-tight",
    headerSubtitle: "text-muted-foreground text-sm",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-semibold text-sm",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground text-xs font-medium uppercase tracking-wider",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-green-600",
    alertText: "text-foreground",
    logoBox: "flex justify-center mb-4",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "border border-input hover:bg-accent/50 transition-colors",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-sm transition-all",
    formFieldInput: "bg-input border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all",
    footerAction: "justify-center pt-6 pb-2",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border border-destructive text-destructive-foreground",
    otpCodeFieldInput: "border-input bg-input text-foreground focus:ring-ring focus:border-transparent",
    formFieldRow: "mb-4",
    main: "px-8 py-6",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
       {/* Decorative background elements */}
       <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
       <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to Kiz Chat",
            subtitle: "Sign in to join the lounge and your DMs",
          },
        },
        signUp: {
          start: {
            title: "Join Kiz Chat",
            subtitle: "Create an account to start chatting",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/lounge" component={Lounge} />
        <Route path="/dms" component={Conversations} />
        <Route path="/dms/:userId" component={DmThread} />
        <Route component={NotFound} />
      </Switch>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}