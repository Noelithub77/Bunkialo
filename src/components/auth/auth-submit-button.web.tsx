interface AuthSubmitButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}

export function AuthSubmitButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
}: AuthSubmitButtonProps) {
  return (
    <button
      aria-busy={loading}
      className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-400 ${variant === "ghost" ? "bg-transparent text-zinc-300 hover:bg-zinc-900" : "border border-amber-300 bg-amber-300 text-zinc-950 hover:border-amber-200 hover:bg-amber-200"}`}
      disabled={disabled || loading}
      onClick={onPress}
      type="button"
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true" />
      ) : null}
      {loading ? title === "Verify" ? "Verifying…" : "Connecting…" : title}
      {!loading && variant !== "ghost" ? <span aria-hidden="true">→</span> : null}
    </button>
  );
}
