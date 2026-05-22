import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

export function HeroUploadSection({
  selectedFile,
  onSelectFile,
}: {
  selectedFile: File | null
  onSelectFile: (file: File | null) => void
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-border/70 bg-background/80 shadow-sm">
      <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:p-10">
        <div className="space-y-6">
          <div className="space-y-3">
            <Badge variant="outline">First step</Badge>
            <h2 className="max-w-2xl font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
              Upload one file to start the analysis.
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              The page stays focused on input first. After you upload and predict,
              the preview and result sections appear below.
            </p>
          </div>

          <label
            className={cn(
              "flex cursor-pointer flex-col gap-4 rounded-[22px] border border-dashed border-border/80 bg-card p-5 transition-colors hover:bg-muted/30",
              selectedFile && "border-primary/35 bg-primary/5"
            )}
            onDragOver={(event) => {
              event.preventDefault()
              event.currentTarget.classList.add("bg-muted/30")
            }}
            onDragLeave={(event) => {
              event.currentTarget.classList.remove("bg-muted/30")
            }}
            onDrop={(event) => {
              event.preventDefault()
              event.currentTarget.classList.remove("bg-muted/30")
              const file = event.dataTransfer.files?.[0] ?? null
              onSelectFile(file)
            }}
          >
            <input
              accept="audio/*,video/*"
              className="sr-only"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                onSelectFile(file)
              }}
            />

            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md border border-border/70 bg-background p-2">
                <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  Drop a file here or click to browse
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Supports audio and video inputs used for the prediction API.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                {selectedFile?.name ?? "No file selected"}
              </Badge>
              <Badge variant="outline">
                {selectedFile?.type || "audio/video"}
              </Badge>
            </div>
          </label>
        </div>

        <div className="rounded-[22px] border border-border/70 bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Upload notes
          </div>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p>Use one audio or video file per prediction request.</p>
            <p>After upload, the page scrolls to the preview and settings band.</p>
            <p>The final result card appears only after you press predict.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
