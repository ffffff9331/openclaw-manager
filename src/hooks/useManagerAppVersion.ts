import { useEffect, useState } from "react";
import { readManagerAppVersion } from "../services/systemService";

export function useManagerAppVersion() {
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const version = await readManagerAppVersion();
        if (!cancelled) {
          setAppVersion(version || "");
        }
      } catch {
        if (!cancelled) {
          setAppVersion("");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return appVersion;
}
