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

export default function ReceiptPage() {
  const { rechargeId } = useParams<{ rechargeId: string }>();
  const navigate = useNavigate();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const settings = useSettings();

  const { data: recharge } = useQuery({
    queryKey: ["recharges", rechargeId],
    queryFn: () => api.get("/recharges/" + rechargeId!),
    enabled: !!rechargeId,
  });

  const handleExport = async () => {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `receipt-${recharge?.customer?.username ?? "customer"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Receipt exported as image!");
    } catch {
      toast.error("Failed to export image");
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(receiptRef.current, { quality: 1, pixelRatio: 2, backgroundColor: "#ffffff" });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `receipt-${recharge?.customer?.username ?? "customer"}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Receipt for ${recharge?.customer?.name}` });
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

  if (recharge === undefined) {
    return (
      <div className="max-w-xl mx-auto space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (recharge === null) {
    return <div className="text-center py-12 text-muted-foreground">Receipt not found.</div>;
  }

  const { customer, package: pkg } = recharge;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">Receipt</h1>
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

      {/* Receipt Card — exported as PNG */}
      <div style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
        <div
          ref={receiptRef}
          style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", background: "#ffffff", padding: "24px", borderRadius: "28px", maxWidth: "420px", width: "420px", margin: "0 auto" }}
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
                <p style={{ fontSize: "12px", color: "#6b7280", margin: "2px 0 0" }}>Payment Receipt</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>Receipt #</p>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e", margin: "4px 0 0", wordBreak: "break-word", maxWidth: "120px" }}>{recharge._id}</p>
            </div>
          </div>

          {/* Receipt Info */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
            <div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>Date</p>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: "4px 0 0" }}>{formatDate(recharge.date)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>Amount</p>
              <p style={{ fontSize: "22px", fontWeight: 800, color: "#1a1a2e", margin: "2px 0 0" }}>{formatAmount(recharge.amount, settings)}</p>
            </div>
          </div>

          {/* Customer Info */}
          <div style={{ background: "#f5f7ff", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
            <p style={{ fontSize: "28px", fontWeight: 800, color: "#1a1a2e", margin: "0 0 6px 0" }}>{customer?.username ?? "—"}</p>
            <p style={{ fontSize: "15px", color: "#374151", margin: "0 0 4px 0" }}>{customer?.name ?? "—"}</p>
            {customer?.phone && <p style={{ fontSize: "14px", color: "#6b7280", margin: "0 0 2px 0" }}>{customer.phone}</p>}
            {customer?.address && <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>{customer.address}</p>}
          </div>

          {/* Package Card */}
          <div style={{ background: "#f4fbf9", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#10b981", marginBottom: "12px" }}>Package</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
              <div>
                <p style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>{pkg?.name ?? "—"}</p>
                {pkg?.speed || pkg?.durationDays ? (
                  <p style={{ fontSize: "14px", color: "#6b7280", margin: "6px 0 0" }}>
                    {pkg?.speed ?? ""}{pkg?.speed && pkg?.durationDays ? " · " : ""}{pkg?.durationDays ? `${pkg.durationDays} Days` : ""}
                  </p>
                ) : null}
              </div>
              <p style={{ fontSize: "22px", fontWeight: 800, color: "#1a1a2e", margin: 0, whiteSpace: "nowrap" }}>
                {formatAmount(recharge.amount, settings)}
              </p>
            </div>
          </div>

          {/* Status + Note Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "24px" }}>
            <div style={{ background: "#f9fafb", borderRadius: "20px", padding: "20px" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 8px 0" }}>Status</p>
              <span style={{
                display: "inline-block",
                padding: "6px 16px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 700,
                background: recharge.paid ? "#dcfce7" : "#fef3c7",
                color: recharge.paid ? "#16a34a" : "#d97706",
              }}>
                {recharge.paid ? "Paid" : "Unpaid"}
              </span>
            </div>
            <div style={{ background: "#f9fafb", borderRadius: "20px", padding: "20px" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 8px 0" }}>Note</p>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#1a1a2e", margin: 0, wordBreak: "break-word" }}>
                {recharge.note || "—"}
              </p>
            </div>
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
