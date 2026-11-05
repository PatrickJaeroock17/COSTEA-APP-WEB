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
        priority
      />
      <span
        className={cn(
          "font-brand text-[28px] font-extrabold leading-none tracking-tight",
          variant === "light" ? "text-[#006b4b]" : "text-white",
        )}
      >
        costea
      </span>
    </Link>
  );
}

