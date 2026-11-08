"use client";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Document, Message } from "@/db/schema";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { MessageBubble } from "./MessageBubble";
import { CitationContext } from "./CitationContext";
import { ChunkPanel } from "./ChunkPanel";

type UIMsg = { role: "user" | "assistant"; content: string };

export function ChatPanel({ doc, initialMessages }: { doc: Document; initialMessages: Message[] }) {
  const [messages, setMessages] = useState<UIMsg[]>(
    initialMessages.map((m) => ({ role: m.role, content: m.content }))
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [citeIdx, setCiteIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const notReady = doc.status !== "ready";

  const openCitation = useCallback((idx: number) => setCiteIdx(idx), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  function replaceLastAssistant(content: string) {
    setMessages((prev) => {
      const next = [...prev]; next[next.length - 1] = { role: "assistant", content };
      return next;
    });
  }

  async function send() {
    const q = input.trim();
    if (!q || streaming || notReady) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch(`/api/documents/${doc.id}/query`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok || !res.body) {
        // Server already sends user-safe text for every error branch.
        const serverText = (await res.text()).trim();
        const fallback = "Something went wrong. Please try again.";
        replaceLastAssistant(`_${serverText || fallback}_`);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        replaceLastAssistant(acc);
      }
    } catch (e) {
      // Network / connection drops — the only error class the client sees first-hand.
      console.error("[chat] send failed", e);
      replaceLastAssistant("_We couldn't reach the server. Please check your connection and try again._");
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  return (
    <CitationContext.Provider value={openCitation}>
      <div className="flex flex-col h-full">
        <header className="h-14 px-5 flex items-center justify-between border-b border-border bg-surface">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{doc.name}</div>
            <div className="text-xs text-muted">Ask anything about this document.</div>
          </div>
          <Badge tone={doc.status === "ready" ? "success" : doc.status === "processing" ? "warning" : "danger"}>
            {doc.status}
          </Badge>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted mt-10">
                {notReady
                  ? "This document is still being prepared — chat will unlock when it's ready."
                  : "Start a conversation. Click any [#N] citation to view the source chunk."}
              </div>
            )}
            {messages.map((m, i) => <MessageBubble key={i} role={m.role} content={m.content} />)}
          </div>
        </div>

        <div className="border-t border-border bg-surface p-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <Textarea
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown}
              placeholder={notReady ? "Preparing document…" : "Ask a question (Enter to send, Shift+Enter for newline)"}
              disabled={notReady || streaming}
              rows={1} className="min-h-[44px] max-h-40"
            />
            <Button onClick={send} loading={streaming} disabled={notReady || !input.trim()} size="icon" aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ChunkPanel documentId={doc.id} idx={citeIdx} onClose={() => setCiteIdx(null)} />
      </div>
    </CitationContext.Provider>
  );
}
