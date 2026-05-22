import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { File01Icon } from "@hugeicons/core-free-icons"

export function PreviewCard({
  selectedFile,
  previewUrl,
  fileName,
  fileType,
  fileDuration,
  onLoadedMetadata,
}: {
  selectedFile: File
  previewUrl: string | null
  fileName: string
  fileType: string
  fileDuration: string
  onLoadedMetadata: (duration: number) => void
}) {
  return (
    <Card className="rounded-[22px] border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Review the uploaded media before running prediction.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedFile.type.startsWith("video/") ? (
          <video
            key={previewUrl ?? selectedFile.name}
            controls
            className="w-full rounded-xl border border-border bg-black"
            src={previewUrl ?? undefined}
            onLoadedMetadata={(event) => {
              onLoadedMetadata(event.currentTarget.duration)
            }}
          />
        ) : (
          <audio
            key={previewUrl ?? selectedFile.name}
            controls
            className="w-full"
            src={previewUrl ?? undefined}
            onLoadedMetadata={(event) => {
              onLoadedMetadata(event.currentTarget.duration)
            }}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Name
            </div>
            <div className="mt-2 truncate font-medium">{fileName}</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Type
            </div>
            <div className="mt-2 truncate font-medium">{fileType}</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Duration
            </div>
            <div className="mt-2 font-medium">{fileDuration}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
