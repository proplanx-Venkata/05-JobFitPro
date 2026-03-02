import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowStep =
  | "gap_analysis"
  | "interview"
  | "rewrite"
  | "cover_letter"
  | "ats_score";

const STEPS: { id: WorkflowStep; label: string }[] = [
  { id: "gap_analysis", label: "Gap Analysis" },
  { id: "interview", label: "Interview" },
  { id: "rewrite", label: "Rewrite" },
  { id: "cover_letter", label: "Cover Letter" },
  { id: "ats_score", label: "ATS Score" },
];

interface WorkflowStepperProps {
  currentStep: WorkflowStep;
}

export function WorkflowStepper({ currentStep }: WorkflowStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="overflow-x-auto -mx-1 px-1">
    <div className="flex items-center gap-0 min-w-max">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "flex flex-col items-center gap-1",
                isCompleted
                  ? "text-primary"
                  : isCurrent
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <CheckCircle className="h-5 w-5" />
              ) : isCurrent ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
              <span className="text-xs font-medium whitespace-nowrap">
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-12 mx-2 mb-4",
                  i < currentIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}
