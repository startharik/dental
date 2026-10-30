"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "dentra-research-auto-analysis-v2";
const CHANGE_EVENT = "dentra:research-auto-analysis-preference-v2";

export function useResearchAutoPreference() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch (error) {
      console.error("Could not load automatic Research Mode preference", error);
      setStorageError(true);
    } finally {
      setLoaded(true);
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setEnabled(event.newValue === "true");
      }
    };
    const handlePreferenceChange = (event: Event) => {
      if (
        event instanceof CustomEvent &&
        typeof event.detail === "boolean"
      ) {
        setEnabled(event.detail);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(CHANGE_EVENT, handlePreferenceChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(CHANGE_EVENT, handlePreferenceChange);
    };
  }, []);

  const updatePreference = useCallback((nextEnabled: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(nextEnabled));
      setEnabled(nextEnabled);
      setStorageError(false);
      window.dispatchEvent(
        new CustomEvent(CHANGE_EVENT, { detail: nextEnabled })
      );
      return true;
    } catch (error) {
      console.error("Could not save automatic Research Mode preference", error);
      setStorageError(true);
      return false;
    }
  }, []);

  return { enabled, loaded, storageError, updatePreference };
}
