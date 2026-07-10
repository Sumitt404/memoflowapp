import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Zap,
  Send,
  Shield,
  Sparkles,
  Activity,
  DollarSign,
  TrendingDown,
  Cpu,
  Bot,
  User as UserIcon,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MemoFlow — AI Customer Support with Hindsight" },
      {
        name: "description",
        content:
          "MemoFlow is an AI-powered B2B customer support agent with cascade routing, budget enforcement, and long-term memory.",
      },
      { property: "og:title", content: "MemoFlow — AI Customer Support with Hindsight" },
      {
        property: "og:description",
        content:
          "Premium AI support agent that remembers your context and routes queries across models for cost & quality.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MemoFlow,
});

type Msg = {
  id: number;
  role: "user" | "ai";
  text: string;
  model?: string;
  hindsight?: boolean;
  recalledMemory?: string | null;
};

// Demo customer — maps to the seeded row in Postgres (backend/db/init.sql).
// Swap this out once you add real customer auth/selection.
const DEMO_CUSTOMER_ID = 1;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const seedMessages: Msg[] = [
  {
    id: 1,
    role: "ai",
    text: "Hi, I'm MemoFlow — ask me anything about your account or setup. I'll remember context across tickets.",
  },
];

function MemoFlow() {
  const [messages, setMessages] = useState<Msg[]>(seedMessages);
  const [input, setInput] = useState("");
  const [activeModel, setActiveModel] = useState<string>("Llama-3 (Groq)");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Budget is real, not simulated: derived from tokens_used the backend
  // actually reports per ticket. Starts at 100% until the first real call.
  const [budget, setBudget] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { id: Date.now(), role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: DEMO_CUSTOMER_ID, message: text }),
      });

      if (!res.ok) {
        throw new Error(`Backend returned ${res.status}`);
      }

      const data = await res.json();

      if (data.model) setActiveModel(data.model);
      if (typeof data.budgetRemainingPct === "number") setBudget(data.budgetRemainingPct);

      const aiMsg: Msg = {
        id: Date.now() + 1,
        role: "ai",
        model: data.model,
        hindsight: Boolean(data.recalledMemory),
        recalledMemory: data.recalledMemory,
        text: data.response,
      };
      setMessages((m) => [...m, aiMsg]);
    } catch (err) {
      setError(
        "Couldn't reach MemoFlow backend. Is it running on " + API_URL + "?",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05010f] text-white">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-600/40 blur-[140px] animate-blob" />
        <div className="absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full bg-cyan-500/30 blur-[140px] animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/3 h-[560px] w-[560px] rounded-full bg-emerald-500/25 blur-[140px] animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,50,255,0.15),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(0,200,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between px-4 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-emerald-400 shadow-[0_0_30px_rgba(139,92,246,0.55)]">
            <Brain className="h-5 w-5 text-black" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
              MemoFlow<span className="text-cyan-300">.</span>ai
            </h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              B2B Support · with Hindsight
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 backdrop-blur-xl sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          All systems nominal
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 pb-8 sm:px-8 lg:grid-cols-10">
        {/* Chat panel */}
        <section className="lg:col-span-6 xl:col-span-7">
          <div className="flex h-[calc(100vh-140px)] min-h-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
                  <Bot className="h-4 w-4 text-cyan-300" />
                </div>
                <div>
                  <div className="text-sm font-medium">Support Session · #A81-42</div>
                  <div className="text-xs text-white/50">Acme Robotics · Enterprise plan</div>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs text-cyan-200 sm:flex">
                <Sparkles className="h-3 w-3" /> Hindsight enabled
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 ring-1 ring-white/20">
                    <Bot className="h-4 w-4 text-black" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" />
                  </div>
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-xs text-red-200">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-3 sm:p-4">
              <div className="group flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2 backdrop-blur-xl focus-within:border-cyan-400/40 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.1)]">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  disabled={isLoading}
                  placeholder="Ask MemoFlow anything — it remembers your stack…"
                  className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={send}
                  disabled={isLoading}
                  className="group/btn relative inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 px-4 text-sm font-semibold text-black shadow-[0_0_30px_rgba(34,211,238,0.5)] transition hover:shadow-[0_0_40px_rgba(139,92,246,0.7)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
              <p className="mt-2 px-1 text-[11px] text-white/40">
                MemoFlow routes your query across models · Enter to send · Shift+Enter for newline
              </p>
            </div>
          </div>
        </section>

        {/* Judge dashboard */}
        <aside className="space-y-4 lg:col-span-4 xl:col-span-3">
          <GlassCard>
            <CardHeader
              icon={<Cpu className="h-4 w-4 text-cyan-300" />}
              label="cascadeflow routing"
              tag="LIVE"
            />
            <div className="mt-3">
              <div className="text-xs text-white/50">Active model</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
                </span>
                <span className="text-lg font-semibold tracking-tight">{activeModel}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1.5 text-[11px]">
                {(["Llama-3 (Groq)", "Claude 3.5", "GPT-4"] as const).map((m) => (
                  <div
                    key={m}
                    className={`rounded-lg border px-2 py-1.5 text-center transition ${
                      activeModel === m
                        ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                        : "border-white/10 bg-white/5 text-white/50"
                    }`}
                  >
                    {m.split(" ")[0]}
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <CardHeader
              icon={<Shield className="h-4 w-4 text-emerald-300" />}
              label="Budget enforcement"
              tag={`${budget.toFixed(0)}%`}
            />
            <div className="mt-4">
              <div className="flex justify-between text-xs text-white/50">
                <span>Token budget remaining</span>
                <span>{Math.round(budget * 1200).toLocaleString()} tok</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500 shadow-[0_0_20px_rgba(52,211,153,0.5)] transition-all duration-700"
                  style={{ width: `${budget}%` }}
                />
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-white/50">
                <Zap className="h-3 w-3 text-emerald-300" />
                Auto-downshift enabled at 20%
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={<Activity className="h-4 w-4 text-purple-300" />}
              label="Q's reduced"
              value="40%"
              hint="Hindsight impact"
              accent="from-purple-500/30 to-transparent"
            />
            <StatCard
              icon={<DollarSign className="h-4 w-4 text-emerald-300" />}
              label="API savings"
              value="64%"
              hint="vs GPT-4 only"
              accent="from-emerald-500/30 to-transparent"
            />
          </div>

          <GlassCard>
            <CardHeader
              icon={<TrendingDown className="h-4 w-4 text-cyan-300" />}
              label="Latency (p50)"
              tag="↓ 3.1×"
            />
            <div className="mt-4 flex items-end gap-1.5">
              {[38, 52, 30, 61, 44, 28, 71, 40, 55, 33, 48, 26].map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-gradient-to-t from-cyan-400/80 to-purple-500/80"
                  style={{ height: `${v}px` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-white/40">
              <span>12h ago</span>
              <span>now</span>
            </div>
          </GlassCard>
        </aside>
      </main>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.08); }
          66% { transform: translate(-30px, 20px) scale(0.95); }
        }
        .animate-blob { animation: blob 14s ease-in-out infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ${
          isUser
            ? "bg-white/10 ring-white/15"
            : "bg-gradient-to-br from-cyan-400 to-purple-500 ring-white/20 shadow-[0_0_20px_rgba(139,92,246,0.4)]"
        }`}
      >
        {isUser ? (
          <UserIcon className="h-4 w-4 text-white" />
        ) : (
          <Brain className="h-4 w-4 text-black" />
        )}
      </div>
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isUser && (
          <div className="flex items-center gap-2 px-1 text-[11px] text-white/50">
            <span className="font-medium text-white/70">MemoFlow AI</span>
            {msg.model && (
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-cyan-200">
                {msg.model}
              </span>
            )}
            {msg.hindsight && (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/20 bg-purple-400/10 px-2 py-0.5 text-purple-200">
                <Sparkles className="h-2.5 w-2.5" /> Hindsight
              </span>
            )}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed backdrop-blur-xl ${
            isUser
              ? "bg-gradient-to-br from-cyan-400/90 to-purple-500/90 text-black shadow-[0_10px_30px_-10px_rgba(139,92,246,0.6)]"
              : "border border-white/10 bg-white/[0.06] text-white/90"
          }`}
        >
          {msg.text}
        </div>
        {msg.recalledMemory && (
          <div className="max-w-full rounded-xl border border-purple-400/20 bg-purple-400/5 px-3 py-2 text-[11px] text-purple-200/80">
            <span className="font-medium text-purple-200">🧠 Recalled: </span>
            {msg.recalledMemory}
          </div>
        )}
      </div>
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  label,
  tag,
}: {
  icon: React.ReactNode;
  label: string;
  tag?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
          {icon}
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">{label}</span>
      </div>
      {tag && (
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium tracking-wider text-white/70">
          {tag}
        </span>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-2xl">
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${accent}`} />
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
          {icon}
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="text-[11px] text-white/50">{hint}</div>
    </div>
  );
}
