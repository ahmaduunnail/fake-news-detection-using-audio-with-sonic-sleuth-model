import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import type { ConfigStatus } from "@/features/prediction/types"

function getStatusLabel(configStatus: ConfigStatus) {
  if (configStatus === "ready") return "Backend connected"
  if (configStatus === "loading") return "Checking backend"
  if (configStatus === "offline") return "Backend offline"
  return "Backend status unknown"
}

export function BackendStatusIndicator({
  configStatus,
}: {
  configStatus: ConfigStatus
}) {
  const statusLabel = getStatusLabel(configStatus)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={statusLabel}
          className="relative flex size-10 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm"
        >
          {configStatus === "loading" ? (
            <>
              <span className="absolute inline-flex size-3 animate-ping rounded-full bg-amber-500/40" />
              <span className="relative inline-flex size-3 animate-spin rounded-full border-2 border-amber-500 border-r-transparent" />
            </>
          ) : configStatus === "offline" ? (
            <>
              <span className="absolute inline-flex size-3 rounded-full bg-red-500/20" />
              <span className="relative inline-flex size-3 rounded-full bg-red-500" />
            </>
          ) : configStatus === "ready" ? (
            <>
              <span className="absolute inline-flex size-3 animate-ping rounded-full bg-emerald-500/50" />
              <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
            </>
          ) : (
            <span className="relative inline-flex size-3 rounded-full bg-muted-foreground" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{statusLabel}</TooltipContent>
    </Tooltip>
  )
}
