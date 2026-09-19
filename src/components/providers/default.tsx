import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";
import { AuthProvider } from "@/lib/auth-context.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider>
      <AuthProvider>
        <TooltipProvider>
          <ThemeProvider>
            <Toaster />
            {children}
          </ThemeProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
