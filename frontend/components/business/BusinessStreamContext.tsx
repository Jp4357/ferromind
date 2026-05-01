"use client";
import { createContext, useContext, ReactNode } from "react";
import { useBusinessStream, BusinessState } from "./useBusinessStream";

const BusinessStreamContext = createContext<BusinessState | null>(null);

export function BusinessStreamProvider({ children }: { children: ReactNode }) {
  const state = useBusinessStream();
  return (
    <BusinessStreamContext.Provider value={state}>
      {children}
    </BusinessStreamContext.Provider>
  );
}

export function useLiveStream(): BusinessState {
  const ctx = useContext(BusinessStreamContext);
  if (!ctx) throw new Error("useLiveStream must be used inside BusinessStreamProvider");
  return ctx;
}
