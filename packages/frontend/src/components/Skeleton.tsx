import { cn } from "../lib/utils";
import { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-800/50",
        className
      )}
      style={style}
    />
  );
}

// Preset skeleton components for common use cases

export function SkeletonStatCard() {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="h-64 flex items-end gap-2 pt-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonProjectCard() {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonSessionItem() {
  return (
    <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="w-4 h-4 rounded" />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
    </div>
  );
}

export function SkeletonText({ width = "w-full" }: { width?: string }) {
  return <Skeleton className={cn("h-4", width)} />;
}
