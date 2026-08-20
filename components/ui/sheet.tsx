"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Sheet({
  trigger,
  title,
  children,
  open,
  onOpenChange,
  className,
}: {
  trigger?: ReactNode;
  title: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-border bg-background p-5 shadow-2xl focus:outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[520px] md:rounded-none",
            className,
          )}
        >
          <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-border md:hidden" />
          <Dialog.Title className="pr-12 text-xl font-semibold">
            {title}
          </Dialog.Title>
          <Dialog.Close
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full hover:bg-surface-alt"
            aria-label="Fechar"
          >
            <X size={20} />
          </Dialog.Close>
          <div className="mt-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
