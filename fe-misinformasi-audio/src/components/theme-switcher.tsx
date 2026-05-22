"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "@/components/theme-provider"

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-2">
      <span className="sr-only">Theme</span>
      <Select value={theme} onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}>
        <SelectTrigger
          aria-label="Theme"
          className="h-9 w-[8.5rem] rounded-md bg-background"
        >
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent align="end">
          {THEME_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
