import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";

export type AppSettings = {
  ispName: string;
  ispTagline: string;
  ispPhone: string;
  ispEmail: string;
  ispAddress: string;
  logoUrl: string;
  currency: string;
  currencySymbol: string;
  currencyPosition: "before" | "after";
};

const DEFAULTS: AppSettings = {
  ispName: "My ISP",
  ispTagline: "Reliable Internet Services",
  ispPhone: "",
  ispEmail: "",
  ispAddress: "",
  logoUrl: "",
  currency: "USD",
  currencySymbol: "$",
  currencyPosition: "before",
};

export function useSettings(): AppSettings {
  const { data: raw } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, string>>("/settings"),
  });
  if (!raw) return DEFAULTS;
  return {
    ispName: raw.ispName ?? DEFAULTS.ispName,
    ispTagline: raw.ispTagline ?? DEFAULTS.ispTagline,
    ispPhone: raw.ispPhone ?? DEFAULTS.ispPhone,
    ispEmail: raw.ispEmail ?? DEFAULTS.ispEmail,
    ispAddress: raw.ispAddress ?? DEFAULTS.ispAddress,
    logoUrl: raw.logoUrl ?? DEFAULTS.logoUrl,
    currency: raw.currency ?? DEFAULTS.currency,
    currencySymbol: raw.currencySymbol ?? DEFAULTS.currencySymbol,
    currencyPosition: (raw.currencyPosition as AppSettings["currencyPosition"]) ?? DEFAULTS.currencyPosition,
  };
}

export function formatAmount(amount: number, settings: AppSettings): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return settings.currencyPosition === "before"
    ? `${settings.currencySymbol}${formatted}`
    : `${formatted}${settings.currencySymbol}`;
}
