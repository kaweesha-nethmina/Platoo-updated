"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface UserContextType {
  user: any;
  setUser: (user: any) => void;
  logout: () => void;
}

interface UserProviderProps {
  children: ReactNode;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUserState] = useState<any>(null);

  // V-08: the JWT lives in an httpOnly cookie set by the BFF. The browser can
  // never read it, so we resolve the session through the BFF which presents the
  // cookie to user-service and returns the safe profile.
  const syncAuth = async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await res.json();
      setUserState(data?.user ?? null);
    } catch (error) {
      console.error("Failed to resolve session:", error);
      setUserState(null);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed:", error);
    }
    // Non-secret identity keys + cached profile, cookie handled BFF-side.
    ["adminId", "restaurantOwnerId", "deliveryManId", "userId", "user"].forEach(
      (k) => localStorage.removeItem(k)
    );
    setUserState(null);
  };

  useEffect(() => {
    syncAuth();

    // Multi-tab sync: identity keys change when another tab logs in/out.
    const handleStorage = () => {
      syncAuth();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setUser = (newUser: any) => {
    setUserState(newUser);
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};