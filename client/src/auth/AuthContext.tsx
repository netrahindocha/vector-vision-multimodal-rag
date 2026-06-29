import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import {
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  setAccessToken,
  type User,
} from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function applySession(nextToken: string | null, nextUser: User | null) {
    setToken(nextToken);
    setUser(nextUser);
    setAccessToken(nextToken);
  }

  useEffect(() => {
    let ignore = false;

    async function restoreSession() {
      try {
        const session = await refreshSession();
        if (!ignore) applySession(session.access_token, session.user);
      } catch {
        if (!ignore) applySession(null, null);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    restoreSession();
    return () => {
      ignore = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken: token,
      isLoading,
      async login(email: string, password: string) {
        const session = await loginUser(email, password);
        applySession(session.access_token, session.user);
      },
      async register(email: string, password: string, name?: string) {
        const session = await registerUser(email, password, name);
        applySession(session.access_token, session.user);
      },
      async logout() {
        try {
          await logoutUser();
        } finally {
          applySession(null, null);
        }
      },
    }),
    [isLoading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
