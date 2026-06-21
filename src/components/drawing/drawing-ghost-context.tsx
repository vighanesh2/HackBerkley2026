"use client";

import { createContext, useContext } from "react";

export type DrawingGhostState = {
  ghostImageUrl: string | null;
  showGhost: boolean;
  guiding: boolean;
};

const DrawingGhostContext = createContext<DrawingGhostState>({
  ghostImageUrl: null,
  showGhost: false,
  guiding: false,
});

export function DrawingGhostProvider({
  value,
  children,
}: {
  value: DrawingGhostState;
  children: React.ReactNode;
}) {
  return (
    <DrawingGhostContext.Provider value={value}>{children}</DrawingGhostContext.Provider>
  );
}

export function useDrawingGhost(): DrawingGhostState {
  return useContext(DrawingGhostContext);
}
