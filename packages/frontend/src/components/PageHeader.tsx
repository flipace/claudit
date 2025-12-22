import { ExternalLink } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description: string;
  learnMoreUrl?: string;
  learnMoreLabel?: string;
}

export function PageHeader({
  title,
  description,
  learnMoreUrl,
  learnMoreLabel = "Learn more",
}: PageHeaderProps) {
  return (
    <div className="px-4 py-4 border-b border-border bg-zinc-900/30">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
        {description}
        {learnMoreUrl && (
          <>
            {" "}
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {learnMoreLabel}
              <ExternalLink className="w-3 h-3" />
            </a>
          </>
        )}
      </p>
    </div>
  );
}
