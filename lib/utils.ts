import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toTitleCaseWords(value: string): string {
  return value.replace(/\b([a-z])([a-z]*)/gi, (_, first: string, rest: string) => {
    return `${first.toUpperCase()}${rest.toLowerCase()}`
  })
}