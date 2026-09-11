'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';

interface SidebarContextType {
  expandedTool: string | null;
  setExpandedTool: (tool: string | null) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  expandedTool: null,
  setExpandedTool: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  return (
    <SidebarContext.Provider value={{ expandedTool, setExpandedTool }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarContext() {
  return useContext(SidebarContext);
}
