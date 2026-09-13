import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "chip inline-flex h-5 max-h-5 w-auto shrink-0 items-center whitespace-nowrap rounded-md border px-1.5 text-[10px] font-medium leading-none tracking-normal",
  {
  variants: {
    variant: {
      default: "border-line text-ink",
      bullish: "border-pos/40 bg-pos/15 text-pos",
      bearish: "border-neg/40 bg-neg/15 text-neg",
      neutral: "border-line bg-mutedbg text-mute",
      warn: "border-warn/40 bg-warn/15 text-warn",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
