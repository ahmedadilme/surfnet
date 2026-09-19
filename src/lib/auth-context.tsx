import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "./api";

type User = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
};

type AuthContext = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  bootstrap: (email: string, password: string, name: string) => Promise<void>;
};

const AuthCtx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const u = await api.get<User>("/auth/me");
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const signIn = async (email: string, password: string) => {
    const res = await api.post<{ user: User }>("/auth/sign-in", { email, password });
    setUser(res.user);
  };

  const signOut = async () => {
    await api.post("/auth/sign-out");
    setUser(null);
  };

  const bootstrap = async (email: string, password: string, name: string) => {
    const res = await api.post<{ user: User }>("/auth/bootstrap", { email, password, name });
    setUser(res.user);
  };

  return (
    <AuthCtx.Provider value={{ user, isLoading, isAuthenticated: !!user, signIn, signOut, bootstrap }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
