import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn con los tokens de globals.css", () => {
  it("un tamaño propio no se pierde junto a un color", () => {
    expect(cn("text-body font-semibold", "text-sidebar-foreground")).toBe("text-body font-semibold text-sidebar-foreground");
    expect(cn("text-caption text-ink")).toBe("text-caption text-ink");
  });

  it("los tamaños propios siguen reemplazando a otros tamaños", () => {
    expect(cn("text-sm text-ink", "text-body")).toBe("text-ink text-body");
    expect(cn("text-body", "text-small")).toBe("text-small");
  });

  it("interletrado, ancho del menú y sombras", () => {
    expect(cn("tracking-label", "tracking-overline")).toBe("tracking-overline");
    expect(cn("w-sidebar", "w-75")).toBe("w-75");
    expect(cn("shadow-soft", "shadow-lift")).toBe("shadow-lift");
  });
});
