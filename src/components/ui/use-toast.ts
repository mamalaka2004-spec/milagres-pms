"use client";

import * as React from "react";

/**
 * useToast — minimal toast store (adapted from the shadcn pattern). A module
 * level reducer holds the queue so any component can call `toast(...)` and the
 * single <Toaster/> mounted in the layout renders it.
 */
type ToastVariant = "default" | "success" | "error";

export interface ToasterToast {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

type Action =
  | { type: "ADD"; toast: ToasterToast }
  | { type: "UPDATE"; toast: Partial<ToasterToast> & { id: string } }
  | { type: "DISMISS"; id?: string }
  | { type: "REMOVE"; id?: string };

interface State {
  toasts: ToasterToast[];
}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const removalTimers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function scheduleRemoval(id: string) {
  if (removalTimers.has(id)) return;
  const timer = setTimeout(() => {
    removalTimers.delete(id);
    dispatch({ type: "REMOVE", id });
  }, 250);
  removalTimers.set(id, timer);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD":
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case "UPDATE":
      return {
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };
    case "DISMISS": {
      const { id } = action;
      if (id) scheduleRemoval(id);
      else state.toasts.forEach((t) => scheduleRemoval(t.id));
      return {
        toasts: state.toasts.map((t) =>
          t.id === id || id === undefined ? { ...t, open: false } : t
        ),
      };
    }
    case "REMOVE":
      if (action.id === undefined) return { toasts: [] };
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

export interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
}

export function toast(opts: ToastOptions) {
  const id = genId();

  const dismiss = () => dispatch({ type: "DISMISS", id });

  dispatch({
    type: "ADD",
    toast: {
      ...opts,
      id,
      open: true,
      duration: opts.duration ?? TOAST_REMOVE_DELAY,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return { id, dismiss, update: (next: Partial<ToasterToast>) => dispatch({ type: "UPDATE", toast: { ...next, id } }) };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (id?: string) => dispatch({ type: "DISMISS", id }),
  };
}
