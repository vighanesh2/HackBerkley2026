type AuthLoadingScreenProps = {
  message?: string;
};

export default function AuthLoadingScreen({
  message = "Checking your session…",
}: AuthLoadingScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="auth-spinner" aria-hidden />
      <p className="mt-8 text-sm font-medium text-notion-text">{message}</p>
      <p className="mt-2 text-xs text-notion-muted">Just a moment</p>
    </div>
  );
}
