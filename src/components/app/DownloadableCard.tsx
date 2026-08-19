import { Download } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives'
import { downloadBlob, fileTimestamp } from '@/lib/xlsx'
import { cn } from '@/lib/utils'

/** Filesystem-safe version of a card title. */
function slug(title: string): string {
  return title
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
}

/**
 * A card that can save itself as a PNG.
 *
 * The control only appears on hover or keyboard focus, so a wall of charts is not also a wall of
 * buttons — but it stays reachable from the keyboard, which a hover-only affordance would not be.
 * It is hidden from the captured image and from print.
 */
export function DownloadableCard({
  title,
  children,
  bodyClassName,
  actions,
}: {
  title: string
  children: ReactNode
  bodyClassName?: string
  actions?: ReactNode
}) {
  const { t } = useTranslation()
  const captureRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  async function saveAsImage() {
    if (!captureRef.current || busy) return
    setBusy(true)

    try {
      // Imported on demand: it is only needed the first time someone saves a card.
      const { toBlob } = await import('html-to-image')

      const blob = await toBlob(captureRef.current, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.excludeFromImage === 'true'),
      })

      if (blob) downloadBlob(blob, `${slug(title)}_${fileTimestamp()}.png`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card ref={captureRef} className="group relative">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>

        <div className="flex items-center gap-1">
          {actions}
          <button
            type="button"
            data-exclude-from-image="true"
            onClick={() => void saveAsImage()}
            disabled={busy}
            title={t('analytics.saveImage')}
            aria-label={`${t('analytics.saveImage')}: ${title}`}
            className={cn(
              'rounded-sm p-1 text-ink-subtle transition-opacity hover:bg-surface-muted hover:text-ink',
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              'print:hidden',
              busy && 'opacity-100',
            )}
          >
            <Download className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </CardHeader>

      <CardBody className={bodyClassName}>{children}</CardBody>
    </Card>
  )
}
