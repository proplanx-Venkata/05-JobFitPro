import { getSystemSetting } from "@/lib/admin/get-setting";
import { SignupForm } from "@/components/auth/signup-form";

export default async function SignupPage() {
  const signupEnabled = await getSystemSetting("signup_enabled");

  if (signupEnabled === false) {
    return (
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Signups are closed</h1>
        <p className="text-muted-foreground text-sm">
          We&apos;re not accepting new accounts at this time.
        </p>
        <a href="/login" className="text-primary text-sm hover:underline">
          Already have an account? Sign in
        </a>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold mb-6 text-center">Create account</h2>
      <SignupForm />
    </>
  );
}
