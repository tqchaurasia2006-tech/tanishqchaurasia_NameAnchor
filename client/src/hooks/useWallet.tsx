"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  connectWallet as connectFreighter,
  getWalletAddress,
  walletIsConnected,
} from "./contract";

interface WalletContextValue {
  address: string | null;
  connecting: boolean;
  installed: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  connecting: false,
  installed: true,
  error: null,
  connect: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-reconnect on load if Freighter is installed and already grants access.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const connected = await walletIsConnected();
      if (cancelled) return;
      setInstalled(connected);
      if (!connected) return;
      const addr = await getWalletAddress();
      if (!cancelled && addr) setAddress(addr);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const connected = await walletIsConnected();
      setInstalled(connected);
      if (!connected) {
        throw new Error(
          "Freighter wallet not detected — install the extension from freighter.app",
        );
      }
      const addr = await connectFreighter();
      setAddress(addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet");
      setAddress(null);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, connecting, installed, error, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  return useContext(WalletContext);
}
