/**
 * Full-screen maintenance notice. Rendered by the root layout's maintenance
 * gate (option A) and by the standalone /maintenance page.
 */
export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center">
      <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
        Maintenance
      </span>
      <h1 className="mt-3 max-w-xl font-display text-3xl font-bold uppercase tracking-tight">
        We&rsquo;ll be right back
      </h1>
      <p className="mt-4 max-w-md whitespace-pre-line text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
