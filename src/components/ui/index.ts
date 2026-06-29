// Design-system primitives — encode Milagres' existing visual language
// (sage-green/brand palette, rounded-xl cards, brand focus rings). No new colors.

// ── Primitives ──
export { Button, buttonVariants, type ButtonProps } from "./button";
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
export { Input } from "./input";
export { Textarea } from "./textarea";
export { Select } from "./select";
export { Badge, badgeVariants, type BadgeProps } from "./badge";
export { Skeleton } from "./skeleton";
export { Spinner } from "./spinner";
export { Label } from "./label";
export { StatusBadge } from "./status-badge";

// ── Composites ──
export { Section } from "./section";
export { PageHeader } from "./page-header";
export { FormField } from "./form-field";
export { EntityRow, DataList, EntityAvatar } from "./entity-row";

// ── Overlays (Radix wrappers) ──
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./sheet";
export { ConfirmDialog, type ConfirmDialogProps } from "./alert-dialog";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
} from "./dropdown-menu";
export { Popover, PopoverTrigger, PopoverAnchor, PopoverClose, PopoverContent } from "./popover";
export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from "./tooltip";

// ── Toast ──
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "./toast";
export { Toaster } from "./toaster";
export { useToast, toast, type ToastOptions } from "./use-toast";
