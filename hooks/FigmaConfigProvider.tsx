"use client";

import { type ReactNode } from "react";
import { FigmaConfigContext, useFigmaConfigState } from "./useFigmaConfig";

export function FigmaConfigProvider({ children }: { children: ReactNode }) {
  const value = useFigmaConfigState();
  return (
    <FigmaConfigContext.Provider value={value}>
      {children}
    </FigmaConfigContext.Provider>
  );
}
