"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface Message {
  role: "assistant" | "user";
  content: string;
}

interface InterviewChatProps {
  sessionId: string;
  initialStatus: string;
  initialTranscript: Message[];
  onCompleted: () => void;
}

export function InterviewChat({
  sessionId,
  initialStatus,
  initialTranscript,
  onCompleted,
}: InterviewChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialTranscript);
  const [status, setStatus] = useState(initialStatus);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startSession() {
    setLoading(true);
    const res = await fetch(`/api/interview-sessions/${sessionId}/start`, {
      method: "POST",
    });
    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to start interview");
      setLoading(false);
      return;
    }

    setMessages(data.data?.conversation_transcript ?? []);
    setStatus("in_progress");
    setLoading(false);
  }

  async function sendReply() {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);

    const res = await fetch(`/api/interview-sessions/${sessionId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to send message");
      setLoading(false);
      return;
    }

    const updated = data.data;
    setMessages(updated?.conversation_transcript ?? []);

    if (updated?.status === "completed") {
      setStatus("completed");
      toast.success("Interview complete! You can now generate your resume.");
      onCompleted();
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  if (status === "pending") {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground mb-4">
          The AI will ask you up to 20 questions to understand your experience
          before rewriting your resume.
        </p>
        <Button onClick={startSession} disabled={loading}>
          {loading ? "Starting…" : "Start Interview"}
        </Button>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pb-2">
          {messages.map((msg, i) => (
            <ChatBubble key={i} message={msg} />
          ))}
        </div>
        <p className="text-sm text-center text-green-700 font-medium">
          Interview complete ✓
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pb-2">
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer… (Enter to send)"
          className="resize-none min-h-[72px]"
          disabled={loading}
        />
        <Button
          size="icon"
          onClick={sendReply}
          disabled={loading || !input.trim()}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Shift+Enter for new line · Enter to send
      </p>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm",
        isAssistant
          ? "self-start bg-neutral-100 text-foreground"
          : "self-end bg-primary text-primary-foreground"
      )}
    >
      {message.content}
    </div>
  );
}
