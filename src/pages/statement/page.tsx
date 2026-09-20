import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Download, Share2, Wifi } from "lucide-react";
import { formatDate } from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";
import { toPng } from "html-to-image";

export default function StatementPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const statementRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const settings = useSettings();

  const { data: customer } = useQuery({
    queryKey: ["customers", customerId],
    queryFn: () => api.get("/customers/" + customerId!),
    enabled: !!customerId,
  });
  const { data: recharges } = useQuery({
    queryKey: ["recharges", "customer", customerId],
    queryFn: () => api.get("/recharges/customer/" + customerId!),
    enabled: !!customerId,
  });

  const totalBilled = recharges?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalPaid = recharges?.reduce((s, r) => s + (r.amountPaid ?? 0), 0) ?? 0;
  const balance = Math.round((totalBilled - totalPaid) * 100) / 100;

  const handleExport = async () => {
    if (!statementRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(statementRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `statement-${customer?.username ?? "customer"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Statement exported as image!");
    } catch {
      toast.error("Failed to export image");
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!statementRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(statementRef.current, { quality: 1, pixelRatio: 2, backgroundColor: "#ffffff" });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `statement-${customer?.username ?? "customer"}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Statement for ${customer?.name}` });
      } else {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = dataUrl;
        link.click();
        toast.info("Sharing not supported on this device — image downloaded instead.");
      }
    } catch {
      toast.error("Failed to share");
    } finally {
      setExporting(false);
    }
  };

  if (customer === undefined || recharges === undefined) {
    return (
      <div className="max-w-xl mx-auto space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (customer === null) {
    return <div className="text-center py-12 text-muted-foreground">Customer not found.</div>;
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => navigate("/customers")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">Customer Statement</h1>
        <div className="ml-auto flex gap-1 sm:gap-2">
          <Button variant="secondary" size="sm" className="cursor-pointer" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export PNG"}</span>
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={handleShare} disabled={exporting}>
            <Share2 className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>

      {/* Statement Card — exported as PNG */}
      <div style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
        <div
          ref={statementRef}
          style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", background: "#ffffff", padding: "24px", borderRadius: "28px", maxWidth: "420px", width: "420px", margin: "0" }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="" style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "contain" }} />
              ) : (
                <div style={{ width: "40px", height: "40px", background: "#1d2340", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Wifi style={{ width: "20px", height: "20px", color: "#fff" }} />
                </div>
              )}
              <div>
                <p style={{ fontWeight: 700, fontSize: "18px", color: "#1a1a2e", margin: 0 }}>{settings.ispName}</p>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: "2px 0 0" }}>Account Statement</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>Generated</p>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e", margin: "4px 0 0" }}>{formatDate(new Date().toISOString().split("T")[0])}</p>
            </div>
          </div>

          {/* Customer Info */}
          <div style={{ background: "#f5f7ff", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
            <p style={{ fontSize: "28px", fontWeight: 800, color: "#1a1a2e", margin: "0 0 6px 0" }}>{customer.username}</p>
            <p style={{ fontSize: "15px", color: "#374151", margin: "0 0 4px 0" }}>{customer.name}</p>
            {customer.phone && <p style={{ fontSize: "14px", color: "#6b7280", margin: "0 0 2px 0" }}>{customer.phone}</p>}
            {customer.address && <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>{customer.address}</p>}
          </div>

          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "24px" }}>
            <div style={{ background: "#f9fafb", borderRadius: "20px", padding: "14px", textAlign: "center", overflow: "hidden", minWidth: 0 }}>
              <p style={{ fontSize: "11px", color: "#6b7280", margin: "0 0 6px 0" }}>Billed</p>
              <p style={{ fontSize: "20px", fontWeight: 800, color: "#1a1a2e", margin: 0, wordBreak: "break-word", lineHeight: 1.2 }}>{formatAmount(totalBilled, settings)}</p>
            </div>
            <div style={{ background: "#f0fdf4", borderRadius: "20px", padding: "14px", textAlign: "center", overflow: "hidden", minWidth: 0 }}>
              <p style={{ fontSize: "11px", color: "#6b7280", margin: "0 0 6px 0" }}>Paid</p>
              <p style={{ fontSize: "20px", fontWeight: 800, color: "#16a34a", margin: 0, wordBreak: "break-word", lineHeight: 1.2 }}>{formatAmount(totalPaid, settings)}</p>
            </div>
            <div style={{ background: balance > 0 ? "#fffbeb" : "#f0fdf4", borderRadius: "20px", padding: "14px", textAlign: "center", overflow: "hidden", minWidth: 0 }}>
              <p style={{ fontSize: "11px", color: "#6b7280", margin: "0 0 6px 0" }}>Due</p>
              <p style={{ fontSize: "20px", fontWeight: 800, color: balance > 0 ? "#d97706" : "#16a34a", margin: 0, wordBreak: "break-word", lineHeight: 1.2 }}>{formatAmount(balance, settings)}</p>
            </div>
          </div>

          {/* Transactions */}
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Transaction History
            </p>
            {recharges.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", textAlign: "center", color: "#9ca3af" }}>
                No transactions yet
              </div>
            ) : (
              recharges.map((r) => {
                  const isPartial = !r.paid && (r.amountPaid ?? 0) > 0;
                  return (
                  <div
                    key={r._id}
                    style={{
                      background: "#fff",
                      borderRadius: "18px",
                      padding: "18px",
                      marginBottom: "12px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "16px", color: "#1a1a2e" }}>
                        {formatDate(r.date)}
                      </p>
                      <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#6b7280" }}>
                        {r.package?.name ?? "-"}
                      </p>
                      {isPartial && (
                        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#d97706", fontWeight: 700 }}>
                          Paid {formatAmount(r.amountPaid ?? 0, settings)} · {formatAmount(r.remaining ?? 0, settings)} left
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "18px", color: "#1a1a2e" }}>
                        {formatAmount(r.amount, settings)}
                      </p>
                      <span style={{
                        display: "inline-block",
                        marginTop: "8px",
                        padding: "6px 14px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 700,
                        background: r.paid ? "#dcfce7" : isPartial ? "#e0e7ff" : "#fef3c7",
                        color: r.paid ? "#16a34a" : isPartial ? "#4338ca" : "#d97706",
                      }}>
                        {r.paid ? "Paid" : isPartial ? "Partial" : "Unpaid"}
                      </span>
                    </div>
                  </div>
                  );
                })
            )}
          </div>

          {/* BML Info */}
          <div style={{ marginTop: "20px", background: "linear-gradient(135deg,#ff7f7f,#ff6b6b)", borderRadius: "24px", padding: "24px", color: "#fff" }}>
            <p style={{ margin: 0, opacity: 0.9 }}>BML Account Name</p>
            <p style={{ margin: "4px 0 14px", fontSize: "20px", fontWeight: 700 }}>
              OCEAN TUNE PVT LTD
            </p>
            <p style={{ margin: 0, opacity: 0.9 }}>BML Account Number</p>
            <p style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 700, letterSpacing: "1px" }}>
              7730000530548
            </p>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", marginTop: "24px" }}>
            Thank you for your business · {settings.ispName}
          </div>
        </div>
      </div>
    </div>
  );
}
