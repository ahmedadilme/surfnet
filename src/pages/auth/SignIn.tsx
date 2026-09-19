import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context.tsx";
import { api } from "@/lib/api.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Wifi } from "lucide-react";

export default function SignIn() {
  const { signIn, bootstrap } = useAuth();
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<boolean>("/auth/needs-bootstrap").then(setNeedsBootstrap).catch(() => setNeedsBootstrap(false));
  }, []);

  if (needsBootstrap === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (needsBootstrap) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary">
              <Wifi className="size-5 text-primary-foreground" />
            </div>
            <CardTitle>Create Admin Account</CardTitle>
            <CardDescription>Set up the first administrator account</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setError(null);
                setBusy(true);
                const formData = new FormData(event.currentTarget);
                try {
                  await bootstrap(formData.get("email") as string, formData.get("password") as string, formData.get("name") as string);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Something went wrong");
                } finally {
                  setBusy(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" type="text" placeholder="Your name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="password" required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating..." : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary">
            <Wifi className="size-5 text-primary-foreground" />
          </div>
          <CardTitle>ISP Billing</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setBusy(true);
              const formData = new FormData(event.currentTarget);
              try {
                await signIn(formData.get("email") as string, formData.get("password") as string);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Something went wrong");
              } finally {
                setBusy(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="password" required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
