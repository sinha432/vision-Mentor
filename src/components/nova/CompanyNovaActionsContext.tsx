import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

import type { CompanyNovaAction } from "@/components/nova/CompanyNovaActions";

type CompanyNovaActionHandler = (action: CompanyNovaAction) => void;

interface CompanyNovaActionsContextValue {
  dispatchAction: (action: CompanyNovaAction) => boolean;
  registerActionHandler: (handler: CompanyNovaActionHandler) => () => void;
}

const CompanyNovaActionsContext = createContext<CompanyNovaActionsContextValue | null>(null);

export function CompanyNovaActionsProvider({ children }: { children: ReactNode }) {
  const actionHandler = useRef<CompanyNovaActionHandler | null>(null);
  const pendingAction = useRef<CompanyNovaAction | null>(null);

  const registerActionHandler = useCallback((handler: CompanyNovaActionHandler) => {
    actionHandler.current = handler;

    if (pendingAction.current) {
      const action = pendingAction.current;
      pendingAction.current = null;
      handler(action);
    }

    return () => {
      if (actionHandler.current === handler) {
        actionHandler.current = null;
      }
    };
  }, []);

  const dispatchAction = useCallback((action: CompanyNovaAction) => {
    if (actionHandler.current) {
      actionHandler.current(action);
      return true;
    }

    pendingAction.current = action;
    return false;
  }, []);

  return (
    <CompanyNovaActionsContext.Provider value={{ dispatchAction, registerActionHandler }}>
      {children}
    </CompanyNovaActionsContext.Provider>
  );
}

export function useCompanyNovaActions() {
  const context = useContext(CompanyNovaActionsContext);

  if (!context) {
    throw new Error("useCompanyNovaActions must be used within CompanyNovaActionsProvider.");
  }

  return context;
}
