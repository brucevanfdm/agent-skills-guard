import React from "react";
import { toast, type ExternalToast } from "sonner";

type ToastPosition = NonNullable<ExternalToast["position"]>;

export type AppToastOptions = Omit<ExternalToast, "position"> & {
  position?: ToastPosition;
};

type BannerTone = "info" | "success" | "error";

type AppToastBannerOptions = {
  duration?: number;
  tone?: BannerTone;
  position?: Extract<ToastPosition, "bottom-center" | "top-center">;
};

const DEFAULT_DURATION_MS = 3000;

const defaultCornerOptions: Pick<ExternalToast, "duration" | "position"> = {
  duration: DEFAULT_DURATION_MS,
  position: "bottom-right",
};

const toneClasses: Record<BannerTone, { container: string; arrow: string; boxShadow: string }> =
  {
    info: {
      container:
        "bg-terminal-cyan/15 border-terminal-cyan text-terminal-cyan shadow-[0_-4px_40px_rgba(94,234,212,0.4)]",
      arrow: "text-terminal-green",
      boxShadow:
        "0 -4px 40px rgba(94, 234, 212, 0.4), inset 0 1px 0 rgba(94, 234, 212, 0.2)",
    },
    success: {
      container:
        "bg-terminal-cyan/15 border-terminal-cyan text-terminal-cyan shadow-[0_-4px_40px_rgba(94,234,212,0.4)]",
      arrow: "text-terminal-green",
      boxShadow:
        "0 -4px 40px rgba(94, 234, 212, 0.4), inset 0 1px 0 rgba(94, 234, 212, 0.2)",
    },
    error: {
      container:
        "bg-terminal-red/15 border-terminal-red text-terminal-red shadow-[0_-4px_40px_rgba(239,68,68,0.35)]",
      arrow: "text-terminal-red",
      boxShadow:
        "0 -4px 40px rgba(239, 68, 68, 0.35), inset 0 1px 0 rgba(239, 68, 68, 0.15)",
    },
  };

export const appToast = {
  message(message: React.ReactNode, options?: AppToastOptions) {
    return toast.message(message, { ...defaultCornerOptions, ...options });
  },
  success(message: React.ReactNode, options?: AppToastOptions) {
    return toast.success(message, { ...defaultCornerOptions, ...options });
  },
  info(message: React.ReactNode, options?: AppToastOptions) {
    return toast.info(message, { ...defaultCornerOptions, ...options });
  },
  warning(message: React.ReactNode, options?: AppToastOptions) {
    return toast.warning(message, { ...defaultCornerOptions, ...options });
  },
  error(message: React.ReactNode, options?: AppToastOptions) {
    return toast.error(message, { ...defaultCornerOptions, ...options });
  },
  loading(message: React.ReactNode, options?: AppToastOptions) {
    return toast.loading(message, { ...defaultCornerOptions, ...options });
  },
  banner(message: React.ReactNode, options?: AppToastBannerOptions) {
    const duration = options?.duration ?? DEFAULT_DURATION_MS;
    const position = options?.position ?? "bottom-center";
    const tone: BannerTone = options?.tone ?? "info";

    return toast.custom(
      (id) =>
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () => toast.dismiss(id),
            className: [
              "w-[min(100vw-2rem,80rem)] px-8 py-5 border-t-2 backdrop-blur-md font-mono text-base text-left",
              "rounded-lg",
              toneClasses[tone].container,
            ].join(" "),
            style: { boxShadow: toneClasses[tone].boxShadow },
          },
          React.createElement(
            "div",
            { className: "flex items-center" },
            React.createElement(
              "span",
              { className: `${toneClasses[tone].arrow} mr-3 text-lg` },
              "❯"
            ),
            React.createElement("span", { className: "tracking-wide" }, message)
          )
        ),
      { duration, position }
    );
  },
};

