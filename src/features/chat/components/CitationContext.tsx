"use client";
import { createContext, useContext } from "react";
export const CitationContext = createContext<(idx: number) => void>(() => {});
export const useCite = () => useContext(CitationContext);
