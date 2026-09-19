import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import { useSettings } from "@/hooks/use-settings.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Wifi, DollarSign, Image, Save, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar (USD)" },
  { code: "EUR", symbol: "€", label: "Euro (EUR)" },
  { code: "GBP", symbol: "£", label: "British Pound (GBP)" },
  { code: "NGN", symbol: "₦", label: "Nigerian Naira (NGN)" },
  { code: "KES", symbol: "KSh", label: "Kenyan Shilling (KES)" },
  { code: "GHS", symbol: "GH₵", label: "Ghanaian Cedi (GHS)" },
  { code: "ZAR", symbol: "R", label: "South African Rand (ZAR)" },
  { code: "INR", symbol: "₹", label: "Indian Rupee (INR)" },
  { code: "PKR", symbol: "Rs", label: "Pakistani Rupee (PKR)" },
  { code: "BDT", symbol: "৳", label: "Bangladeshi Taka (BDT)" },
  { code: "PHP", symbol: "₱", label: "Philippine Peso (PHP)" },
  { code: "IDR", symbol: "Rp", label: "Indonesian Rupiah (IDR)" },
  { code: "MYR", symbol: "RM", label: "Malaysian Ringgit (MYR)" },
  { code: "TZS", symbol: "TSh", label: "Tanzanian Shilling (TZS)" },
  { code: "UGX", symbol: "USh", label: "Ugandan Shilling (UGX)" },
  { code: "EGP", symbol: "E£", label: "Egyptian Pound (EGP)" },
  { code: "MAD", symbol: "MAD", label: "Moroccan Dirham (MAD)" },
  { code: "XOF", symbol: "CFA", label: "West African CFA Franc (XOF)" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar (CAD)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (AUD)" },
  { code: "BRL", symbol: "R$", label: "Brazilian Real (BRL)" },
  { code: "MXN", symbol: "MX$", label: "Mexican Peso (MXN)" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham (AED)" },
  { code: "SAR", symbol: "﷼", label: "Saudi Riyal (SAR)" },
  { code: "OTHER", symbol: "", label: "Other (custom)" },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: role } = useQuery({
    queryKey: ["auth", "current-role"],
    queryFn: () => api.get("/auth/current-role"),
  });
  const current = useSettings();
  const setMany = useMutation({
    mutationFn: (data: { entries: { key: string; value: string }[] }) =>
      api.post("/settings/set-many", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (role === "staff") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-sm mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="w-5 h-5 text-destructive" /> Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Staff accounts cannot access Settings. Contact an admin to make changes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [ispName, setIspName] = useState(current.ispName);
  const [ispTagline, setIspTagline] = useState(current.ispTagline);
  const [ispPhone, setIspPhone] = useState(current.ispPhone);
  const [ispEmail, setIspEmail] = useState(current.ispEmail);
  const [ispAddress, setIspAddress] = useState(current.ispAddress);
  const [logoUrl, setLogoUrl] = useState(current.logoUrl);
  const [currency, setCurrency] = useState(current.currency);
  const [currencySymbol, setCurrencySymbol] = useState(current.currencySymbol);
  const [currencyPosition, setCurrencyPosition] = useState<"before" | "after">(current.currencyPosition);
  const [saving, setSaving] = useState(false);

  // Sync state when settings load (first render may have defaults)
  const [synced, setSynced] = useState(false);
  if (!synced && current.ispName !== "My ISP") {
    setIspName(current.ispName);
    setIspTagline(current.ispTagline);
    setIspPhone(current.ispPhone);
    setIspEmail(current.ispEmail);
    setIspAddress(current.ispAddress);
    setLogoUrl(current.logoUrl);
    setCurrency(current.currency);
    setCurrencySymbol(current.currencySymbol);
    setCurrencyPosition(current.currencyPosition);
    setSynced(true);
  }

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    const found = CURRENCIES.find((c) => c.code === code);
    if (found && code !== "OTHER") {
      setCurrencySymbol(found.symbol);
    }
  };

  const handleSave = async () => {
    if (!ispName.trim()) { toast.error("ISP name is required"); return; }
    setSaving(true);
    try {
      await setMany.mutateAsync({
        entries: [
          { key: "ispName", value: ispName.trim() },
          { key: "ispTagline", value: ispTagline.trim() },
          { key: "ispPhone", value: ispPhone.trim() },
          { key: "ispEmail", value: ispEmail.trim() },
          { key: "ispAddress", value: ispAddress.trim() },
          { key: "logoUrl", value: logoUrl.trim() },
          { key: "currency", value: currency },
          { key: "currencySymbol", value: currencySymbol },
          { key: "currencyPosition", value: currencyPosition },
        ],
      });
      toast.success("Settings saved!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const preview =
    currencyPosition === "before"
      ? `${currencySymbol}29.99`
      : `29.99${currencySymbol}`;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your ISP business information
        </p>
      </div>

      {/* ISP Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="w-4 h-4 text-primary" /> ISP Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Business Name *</Label>
              <Input
                placeholder="My ISP"
                value={ispName}
                onChange={(e) => setIspName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tagline</Label>
              <Input
                placeholder="Reliable Internet Services"
                value={ispTagline}
                onChange={(e) => setIspTagline(e.target.value)}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                placeholder="+1 555 0000"
                value={ispPhone}
                onChange={(e) => setIspPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="billing@myisp.com"
                value={ispEmail}
                onChange={(e) => setIspEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input
              placeholder="123 Network St, City"
              value={ispAddress}
              onChange={(e) => setIspAddress(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="w-4 h-4 text-primary" /> Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Logo URL</Label>
            <Input
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL to your logo image (shown on receipts and statements). Leave empty to use the default icon.
            </p>
          </div>
          {logoUrl && (
            <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Logo preview"
                className="w-10 h-10 rounded object-contain bg-white"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
              <span className="hidden text-xs text-destructive">Failed to load image</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Currency
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="cursor-pointer">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Currency Symbol</Label>
              <Input
                placeholder="$"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Edit freely for custom currencies
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Symbol Position</Label>
              <Select
                value={currencyPosition}
                onValueChange={(v) => setCurrencyPosition(v as "before" | "after")}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before" className="cursor-pointer">Before amount ({currencySymbol}100)</SelectItem>
                  <SelectItem value="after" className="cursor-pointer">After amount (100{currencySymbol})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="bg-muted rounded-lg px-4 py-3 text-sm">
            Preview: <span className="font-bold">{preview}</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full cursor-pointer">
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
