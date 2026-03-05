import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="text-xl font-semibold mb-2 text-center">Reset your password</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </>
  );
}
