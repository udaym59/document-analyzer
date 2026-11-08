"use client";
import { Bot, User } from "lucide-react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";
import { cn } from "@/shared/lib/cn";
import { useCite } from "./CitationContext";

const CITE_SCHEME = "da-cite:";

const urlTransform = (url: string) =>
  url.startsWith(CITE_SCHEME) ? url : defaultUrlTransform(url);

function annotateCitations(src: string): string {
  return src.replace(/\[#(\d+(?:\s*,\s*#?\d+)*)\]/g, (_m, group: string) => {
    const nums = group.split(/\s*,\s*/).map((s) => s.replace(/^#/, ""));
    return nums.map((n) => `[#${n}](${CITE_SCHEME}${n})`).join(" ");
  });
}

export function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  const cite = useCite();

  const annotated = useMemo(() => (isUser ? content : annotateCitations(content)), [isUser, content]);

  const components: Components = {
    a({ href, children, ...rest }) {
      if (href?.startsWith(CITE_SCHEME)) {
        const idx = Number(href.slice(CITE_SCHEME.length));
        return (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); cite(idx); }}
            className="inline-flex items-center align-baseline px-1.5 py-0 rounded text-[0.75em] font-medium
                       bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors
                       no-underline cursor-pointer"
          >
            {children}
          </button>
        );
      }
      return <a href={href} target="_blank" rel="noreferrer" {...rest}>{children}</a>;
    },
  };

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "shrink-0 h-8 w-8 rounded-full grid place-items-center",
        isUser ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
        isUser ? "user-bubble bg-accent text-accent-fg" : "bg-surface border border-border",
      )}>
        {isUser
          ? <div className="whitespace-pre-wrap">{content}</div>
          : <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
                urlTransform={urlTransform}
              >
                {annotated || "…"}
              </ReactMarkdown>
            </div>}
      </div>
    </div>
  );
}
