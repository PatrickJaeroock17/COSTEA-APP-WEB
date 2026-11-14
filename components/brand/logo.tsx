import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ variant = "light", className }: { variant?: "light" | "dark"; className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)} aria-label="costea, inicio">
      <Image
        src={variant === "light" ? "/brand/costea-symbol.svg" : "/brand/costea-symbol-white.svg"}
        alt=""
        width={40}
        height={40}
        className="size-8 md:size-10"
        priority
      />
      <span
        className={cn(
          "font-brand text-2xl font-extrabold leading-none tracking-[-0.01em] md:text-[28px]",
          variant === "light" ? "text-brand-600" : "text-white",
        )}
      >
        costea
      </span>
    </Link>
  );
}


