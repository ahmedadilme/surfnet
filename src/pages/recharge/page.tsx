import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Zap, ChevronsUpDown, Check } from "lucide-react";
import { cn, todayISO } from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";
import { useNavigate } from "react-router-dom";

function SearchableSelect<T extends { _id: string; label: string; keywords?: string[] }>({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  notFoundText,
}: {
  options: T[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  notFoundText: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o._id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? selected.label : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{notFoundText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option._id}
                  value={option._id}
                  keywords={option.keywords}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option._id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function RechargePage() {
  const queryClient = useQueryClient();
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
  });
  const { data: packages } = useQuery({
    queryKey: ["packages"],
    queryFn: () => api.get("/packages"),
  });
  const createRecharge = useMutation({
    mutationFn: (data: { customerId: string; packageId: string; amount: number; date: string; note?: string }) =>
      api.post("/recharges", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recharges"] });
      queryClient.invalidateQueries({ queryKey: ["recharges", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["recharges", "unpaidTotals"] });
      queryClient.invalidateQueries({ queryKey: ["recharges", "monthly"] });
    },
  });
  const settings = useSettings();

  const [customerId, setCustomerId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const selectedPackage = packages?.find((p) => p._id === packageId);

  const customerOptions = (customers ?? []).map((c) => ({
    _id: c._id,
    label: `${c.username} — ${c.name}`,
    keywords: [c.username, c.name].filter(Boolean),
  }));

  const packageOptions = (packages ?? []).map((p) => ({
    _id: p._id,
    label: `${p.name} — ${formatAmount(p.price, settings)} / ${p.durationDays}d`,
    keywords: [p.name, String(p.durationDays)].filter(Boolean),
  }));

  const handleSubmit = async () => {
    if (!customerId || !packageId) {
      toast.error("Please select a customer and package");
      return;
    }
    if (!selectedPackage) return;

    setSaving(true);
    try {
      const result = await createRecharge.mutateAsync({
        customerId,
        packageId,
        amount: selectedPackage.price,
        date,
        note: note || undefined,
      });
      const rechargeId = result?._id ?? result;
      toast.success("Recharge recorded successfully!");
      navigate(`/receipt/${rechargeId}`);
      setCustomerId("");
      setPackageId("");
      setNote("");
      setDate(todayISO());
    } catch {
      toast.error("Failed to record recharge");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold">New Recharge</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Select a customer and package to record a recharge
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Recharge Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <SearchableSelect
              options={customerOptions}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Select customer..."
              searchPlaceholder="Search customers..."
              notFoundText="No customer found"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Package *</Label>
            <SearchableSelect
              options={packageOptions}
              value={packageId}
              onChange={setPackageId}
              placeholder="Select package..."
              searchPlaceholder="Search packages..."
              notFoundText="No package found"
            />
          </div>

          {selectedPackage && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-medium">{selectedPackage.name}</p>
              <p className="text-2xl font-bold text-primary mt-1">
                {formatAmount(selectedPackage.price, settings)}
              </p>
              {selectedPackage.speed && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedPackage.speed} · {selectedPackage.durationDays} days
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input
              placeholder="Any notes about this recharge..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Button
            className="w-full cursor-pointer"
            onClick={handleSubmit}
            disabled={saving || !customerId || !packageId}
          >
            <Zap className="w-4 h-4 mr-2" />
            {saving ? "Recording..." : "Record Recharge"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
