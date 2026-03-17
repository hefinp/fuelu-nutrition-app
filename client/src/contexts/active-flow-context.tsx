import { createContext, useContext, useState, useCallback } from "react";

interface ActiveFlowContextValue {
  activeFlows: Set<string>;
  setFlowActive: (flowId: string, active: boolean) => void;
  isAnyFlowActive: boolean;
}

const ActiveFlowContext = createContext<ActiveFlowContextValue>({
  activeFlows: new Set(),
  setFlowActive: () => {},
  isAnyFlowActive: false,
});

export function ActiveFlowProvider({ children }: { children: React.ReactNode }) {
  const [activeFlows, setActiveFlows] = useState<Set<string>>(new Set());

  const setFlowActive = useCallback((flowId: string, active: boolean) => {
    setActiveFlows(prev => {
      const next = new Set(prev);
      if (active) {
        next.add(flowId);
      } else {
        next.delete(flowId);
      }
      return next;
    });
  }, []);

  return (
    <ActiveFlowContext.Provider value={{
      activeFlows,
      setFlowActive,
      isAnyFlowActive: activeFlows.size > 0,
    }}>
      {children}
    </ActiveFlowContext.Provider>
  );
}

export function useActiveFlow() {
  return useContext(ActiveFlowContext);
}
