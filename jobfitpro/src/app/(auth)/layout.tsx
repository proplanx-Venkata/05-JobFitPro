export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border p-8">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold text-primary">JobFit Pro</span>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered resume optimization
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
