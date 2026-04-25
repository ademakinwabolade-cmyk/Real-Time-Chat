import { Show } from "@clerk/react";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight, Users, Lock, Zap } from "lucide-react";
import { motion } from "framer-motion";

export function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <header className="py-6 px-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-sm">
            <MessageSquare size={20} strokeWidth={2.5} />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight">Kiz Chat</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="font-medium">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="rounded-full font-medium shadow-sm hover-elevate">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 z-10 text-center pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            The lounge is open
          </div>

          <h1 className="text-5xl md:text-7xl font-serif font-bold text-foreground leading-[1.1] tracking-tight">
            Chat in public. Whisper in private.
          </h1>

          <p className="text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            One warm public lounge for everyone, plus private one-on-one direct messages. Real-time, persistent, and secure.
          </p>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="rounded-full text-base h-14 px-8 shadow-md hover-elevate gap-2 w-full sm:w-auto">
                Join Kiz Chat <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="rounded-full text-base h-14 px-8 w-full sm:w-auto">
                I already have an account
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-4xl mx-auto text-left"
        >
          <div className="bg-card border border-card-border p-6 rounded-2xl shadow-sm">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <h3 className="font-bold text-lg mb-2">Public Lounge</h3>
            <p className="text-muted-foreground text-sm">Everyone in one shared room. See who's online and jump into the conversation.</p>
          </div>
          <div className="bg-card border border-card-border p-6 rounded-2xl shadow-sm">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4">
              <Lock size={20} />
            </div>
            <h3 className="font-bold text-lg mb-2">Private DMs</h3>
            <p className="text-muted-foreground text-sm">One-on-one direct messages with anyone in the room. Only you and them can see them.</p>
          </div>
          <div className="bg-card border border-card-border p-6 rounded-2xl shadow-sm">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4">
              <Zap size={20} />
            </div>
            <h3 className="font-bold text-lg mb-2">Real-time, Always On</h3>
            <p className="text-muted-foreground text-sm">Messages and presence stream live. The lounge stays open 24/7 — your link works anywhere.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/lounge" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}
