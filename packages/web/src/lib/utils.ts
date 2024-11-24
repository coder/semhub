import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Prevents mobile browsers from auto-zooming on input fields
// by maintaining 16px font size on mobile and smaller on desktop
export const preventInputZoom = "text-base sm:text-sm";
