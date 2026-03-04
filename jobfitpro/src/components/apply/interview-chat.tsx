"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, Send } from "lucide-react";

interface Message {
  role: "assistant" | "user";
  content: string;
}

interface InterviewChatProps {
  sessionId: string;
  initialStatus: string;
  initialTranscript: Message[];
  initialApprovedAnswers?: Record<string, string>;
}

export function InterviewChat({
  sessionId,
  initialStatus,
  initialTranscript,
  initialApprovedAnswers,
}: InterviewChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialTranscript);
  const [status, setStatus] = useState(initialStatus);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Edit answers state
  const [editOpen, setEditOpen] = useState(false);
  const [editAnswers, setEditAnswers] = useState<Record<string, string>>(
    initialApprovedAnswers ?? {}
  );
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startSession() {
    setLoading(true);
    try {
      const res = await fetch(`/api/interview-sessions/${sessionId}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to start interview");
        return;
      }
      setMessages(data.data?.conversation_transcript ?? []);
      setStatus("in_progress");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    try {
      const res = await fetch(`/api/interview-sessions/${sessionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send message");
        return;
      }
      const updated = data.data;
      setMessages(updated?.conversation_transcript ?? []);
      if (updated?.status === "completed") {
        setStatus("completed");
        toast.success("Interview complete! You can now generate your resume.");
        router.refresh();
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAnswers() {
    setEditLoading(true);
    try {
      const res = await fetch(`/api/interview-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_answers: editAnswers }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save answers");
        return;
      }
      setEditOpen(false);
      toast.success("Answers saved. Regenerate your resume to apply changes.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setEditLoading(false);
    }
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
    const answerKeys = Object.keys(editAnswers);
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

        {answerKeys.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (!editOpen) setEditAnswers(initialApprovedAnswers ?? {});
                setEditOpen(!editOpen);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-left hover:bg-neutral-50 transition-colors"
            >
              <span>Edit Answers</span>
              {editOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {editOpen && (
              <div className="px-4 pb-4 space-y-3 border-t pt-3">
                {answerKeys.map((key) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {key}
                    </Label>
                    <Textarea
                      value={editAnswers[key]}
                      onChange={(e) =>
                        setEditAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="resize-none min-h-[60px]"
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleSaveAnswers}
                    disabled={editLoading}
                    className="gap-1.5"
                  >
                    {editLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditAnswers(initialApprovedAnswers ?? {});
                      setEditOpen(false);
                    }}
                    disabled={editLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
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
