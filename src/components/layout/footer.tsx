import { getSiteTexts } from "@/lib/services/settings.service";

export async function Footer() {
  const texts = await getSiteTexts();
  return (
    <footer className="border-t border-border/60">
      <div className="container flex flex-col items-center justify-between gap-2 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>{texts.footerText}</p>
        <p>&copy; {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
