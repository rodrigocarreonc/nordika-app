import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { ConfirmDialog, DialogButton } from "../components/ConfirmDialog";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: "default" | "destructive";
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface AlertOptions {
  title: string;
  message?: string;
  buttonText?: string;
  onConfirm?: () => void | Promise<void>;
}

export interface CustomDialogOptions {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

interface DialogState {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: "default" | "destructive";
  buttons?: DialogButton[];
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showAlert: (options: AlertOptions) => Promise<void>;
  showDialog: (options: CustomDialogOptions) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// Module-level global reference for imperative calls outside React trees
let globalHandler: DialogContextValue | null = null;

export const dialog = {
  confirm: (options: ConfirmOptions): Promise<boolean> => {
    if (globalHandler) return globalHandler.confirm(options);
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.confirm === "function"
    ) {
      const res = window.confirm(
        `${options.title}\n\n${options.message ?? ""}`,
      );
      if (res && options.onConfirm) options.onConfirm();
      if (!res && options.onCancel) options.onCancel();
      return Promise.resolve(res);
    }
    return Promise.resolve(false);
  },
  alert: (options: AlertOptions): Promise<void> => {
    if (globalHandler) return globalHandler.showAlert(options);
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.alert === "function"
    ) {
      window.alert(`${options.title}\n\n${options.message ?? ""}`);
      if (options.onConfirm) options.onConfirm();
      return Promise.resolve();
    }
    return Promise.resolve();
  },
  show: (options: CustomDialogOptions) => {
    if (globalHandler) globalHandler.showDialog(options);
  },
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [dialogState, setDialogState] = useState<DialogState>({
    visible: false,
    title: "",
  });

  type PendingDialog =
    | { type: "confirm"; resolve: (value: boolean) => void }
    | { type: "alert"; resolve: () => void };

  const resolverRef = useRef<PendingDialog | null>(null);
  const lastClosedAtRef = useRef<number>(0);

  const resolvePendingDialog = useCallback(() => {
    const pending = resolverRef.current;
    if (!pending) return;
    resolverRef.current = null;
    if (pending.type === "confirm") {
      pending.resolve(false);
    } else {
      pending.resolve();
    }
  }, []);

  const waitNativeModalDismiss = useCallback(async () => {
    if (Platform.OS === "web") return;
    const elapsed = Date.now() - lastClosedAtRef.current;
    if (elapsed < 280) {
      await new Promise((r) => setTimeout(r, 280 - elapsed));
    }
  }, []);

  const closeDialog = useCallback(() => {
    lastClosedAtRef.current = Date.now();
    setDialogState((prev) => ({ ...prev, visible: false }));
  }, []);

  const confirm = useCallback(
    async (options: ConfirmOptions): Promise<boolean> => {
      resolvePendingDialog();
      await waitNativeModalDismiss();
      resolvePendingDialog();
      return new Promise<boolean>((resolve) => {
        const pending: PendingDialog = { type: "confirm", resolve };
        resolverRef.current = pending;
        setDialogState({
          visible: true,
          title: options.title,
          message: options.message,
          confirmText: options.confirmText ?? "Aceptar",
          cancelText: options.cancelText ?? "Cancelar",
          confirmStyle: options.confirmStyle ?? "default",
          onConfirm: async () => {
            try {
              if (options.onConfirm) {
                await options.onConfirm();
              }
            } finally {
              if (resolverRef.current === pending) {
                resolverRef.current = null;
              }
              closeDialog();
              resolve(true);
            }
          },
          onCancel: () => {
            if (options.onCancel) options.onCancel();
            if (resolverRef.current === pending) {
              resolverRef.current = null;
            }
            closeDialog();
            resolve(false);
          },
          onClose: () => {
            if (options.onCancel) options.onCancel();
            if (resolverRef.current === pending) {
              resolverRef.current = null;
            }
            closeDialog();
            resolve(false);
          },
        });
      });
    },
    [closeDialog, resolvePendingDialog, waitNativeModalDismiss],
  );

  const showAlert = useCallback(
    async (options: AlertOptions): Promise<void> => {
      resolvePendingDialog();
      await waitNativeModalDismiss();
      resolvePendingDialog();
      return new Promise<void>((resolve) => {
        const pending: PendingDialog = { type: "alert", resolve };
        resolverRef.current = pending;
        setDialogState({
          visible: true,
          title: options.title,
          message: options.message,
          confirmText: options.buttonText ?? "Aceptar",
          cancelText: undefined, // no cancel button
          confirmStyle: "default",
          onConfirm: async () => {
            try {
              if (options.onConfirm) {
                await options.onConfirm();
              }
            } finally {
              if (resolverRef.current === pending) {
                resolverRef.current = null;
              }
              closeDialog();
              resolve();
            }
          },
          onClose: () => {
            if (options.onConfirm) options.onConfirm();
            if (resolverRef.current === pending) {
              resolverRef.current = null;
            }
            closeDialog();
            resolve();
          },
        });
      });
    },
    [closeDialog, resolvePendingDialog, waitNativeModalDismiss],
  );

  const showDialog = useCallback(
    async (options: CustomDialogOptions) => {
      resolvePendingDialog();
      await waitNativeModalDismiss();
      resolvePendingDialog();
      setDialogState({
        visible: true,
        title: options.title,
        message: options.message,
        buttons: options.buttons.map((btn) => ({
          ...btn,
          onPress: async () => {
            try {
              if (btn.onPress) {
                await btn.onPress();
              }
            } finally {
              closeDialog();
            }
          },
        })),
        onClose: closeDialog,
      });
    },
    [closeDialog, resolvePendingDialog, waitNativeModalDismiss],
  );

  const contextValue = useMemo<DialogContextValue>(
    () => ({
      confirm,
      showAlert,
      showDialog,
    }),
    [confirm, showAlert, showDialog],
  );

  useEffect(() => {
    globalHandler = contextValue;
    return () => {
      if (globalHandler === contextValue) {
        globalHandler = null;
      }
      resolvePendingDialog();
    };
  }, [contextValue, resolvePendingDialog]);

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      <ConfirmDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmStyle={dialogState.confirmStyle}
        buttons={dialogState.buttons}
        onConfirm={dialogState.onConfirm}
        onCancel={dialogState.onCancel}
        onClose={dialogState.onClose}
      />
    </DialogContext.Provider>
  );
};

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}
