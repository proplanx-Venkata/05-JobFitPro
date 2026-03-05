import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <>
      <h2 className="text-xl font-semibold mb-6 text-center">Set new password</h2>
      <Suspense
        fallback={
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
