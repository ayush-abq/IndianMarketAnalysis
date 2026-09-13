import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-line bg-elev px-2.5 text-sm text-ink outline-none placeholder:text-mute focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
