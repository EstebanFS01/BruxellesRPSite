import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const ServerCtx = createContext({ wl_mode: "wl", whitelist_open: true });

export function ServerProvider({ children }) {
  const [settings, setSettings] = useState({ wl_mode: "wl", whitelist_open: true });

  useEffect(() => {
    api.get("/server/settings")
      .then((r) => setSettings(r.data))
      .catch(() => {});
  }, []);

  return <ServerCtx.Provider value={settings}>{children}</ServerCtx.Provider>;
}

export const useServer = () => useContext(ServerCtx);
