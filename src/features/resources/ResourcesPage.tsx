import { Check, ClipboardList, Download, ExternalLink, Eye, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StateBoundary } from '@/components/app/StateBoundary'
import { Button, Card, CardBody, Skeleton } from '@/components/ui/primitives'
import {
  useDeleteResource,
  useEngagementStats,
  useMyEngagement,
  useRecordEngagement,
  useResources,
} from '@/features/admin/hooks'
import {
  useCurrentEmployeeId,
  useIsAdmin,
} from '@/features/auth/useSession'
import { formatDate, formatNumber } from '@/lib/format'

import { CreateResourcePanel } from './CreateResourcePanel'

// Fallback to current window origin if API base URL isn't explicitly set in env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin

function Readership({ stats }: { stats?: { viewCount: number; eligibleEmployees: number } }) {
  const { t, i18n } = useTranslation()

  if (!stats) return null

  const percentage =
    stats.eligibleEmployees === 0
      ? 0
      : Math.round((stats.viewCount / stats.eligibleEmployees) * 100)

  return (
    <div className="mt-2 border-t border-border-subtle pt-2">
      <p className="text-xs text-ink-muted" data-numeric>
        {t('resource.viewedBy', {
          viewed: formatNumber(stats.viewCount, i18n.language),
          total: formatNumber(stats.eligibleEmployees, i18n.language),
        })}{' '}
        <span className="text-ink-subtle">({percentage}%)</span>
      </p>

      <div className="mt-1 h-1.5 w-full rounded-sm bg-surface-muted">
        <div
          className="h-1.5 rounded-sm bg-accent"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function affordance(type: string) {
  switch (type) {
    case 'Quiz':
      return {
        labelKey: 'resource.takeSurvey',
        icon: ClipboardList,
        isSurvey: true,
        isFile: false,
      }

    case 'Video':
      return {
        labelKey: 'resource.watchVideo',
        icon: ExternalLink,
        isSurvey: false,
        isFile: false,
      }

    case 'Link':
      return {
        labelKey: 'resource.open',
        icon: ExternalLink,
        isSurvey: false,
        isFile: false,
      }

    default:
      // File and Image are stored on the server and served as downloads.
      return {
        labelKey: 'resource.download',
        icon: Download,
        isSurvey: false,
        isFile: true,
      }
  }
}

/** Resolves relative resource paths against the backend API base URL. */
function resolveResourceUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  return new URL(url, API_BASE_URL).href
}

/**
 * Fetches the file as a Blob and forces an immediate download.
 *
 * This prevents images/files from opening in a new browser tab.
 */
async function triggerFileDownload(fullUrl: string, fileName: string) {
  try {
    console.log('Downloading:', fullUrl)

    const response = await fetch(fullUrl, {
      method: 'GET',
      credentials: 'include',
    })

    console.log('Response:', response.status, response.headers)

    if (!response.ok) {
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`,
      )
    }

    const blob = await response.blob()

    console.log('Blob:', blob.type, blob.size)

    const blobUrl = window.URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = fileName || 'download'
    anchor.style.display = 'none'

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl)
    }, 1000)
  } catch (error) {
    console.error('DOWNLOAD ERROR:', error)
  }
}

export function ResourcesPage() {
  const { t, i18n } = useTranslation()
  const isAdmin = useIsAdmin()
  const employeeId = useCurrentEmployeeId()

  const resources = useResources()
  const engagement = useMyEngagement()
  const record = useRecordEngagement()
  const remove = useDeleteResource()
  const stats = useEngagementStats({ enabled: isAdmin })
  const [uploading, setUploading] = useState(false)

  const engagementByResource = useMemo(() => {
    const map = new Map<number, { viewed: boolean; surveyCompleted: boolean }>()

    for (const item of engagement.data ?? []) {
      map.set(item.resource.id, {
        viewed: item.viewed,
        surveyCompleted: item.surveyCompleted,
      })
    }

    return map
  }, [engagement.data])

  const statsByResource = useMemo(() => {
    const map = new Map<number, { viewCount: number; eligibleEmployees: number }>()

    for (const item of stats.data ?? []) {
      map.set(item.resourceId, {
        viewCount: item.viewCount,
        eligibleEmployees: item.eligibleEmployees,
      })
    }

    return map
  }, [stats.data])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-ink">
          {t('nav.resources')}
        </h1>

        {isAdmin ? (
          <Button type="button" onClick={() => setUploading(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            {t('resource.add')}
          </Button>
        ) : null}
      </div>

      {uploading ? (
        <CreateResourcePanel onClose={() => setUploading(false)} />
      ) : null}

      <StateBoundary
        isLoading={resources.isPending}
        error={resources.error}
        data={resources.data}
        onRetry={() => void resources.refetch()}
        skeleton={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        }
        isEmpty={(list) => list.length === 0}
      >
        {(list) => (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((resource) => {
              const mine = engagementByResource.get(resource.id)

              const {
                labelKey,
                icon: ActionIcon,
                isSurvey,
                isFile,
              } = affordance(resource.type)

              return (
                <Card key={resource.id} className="flex flex-col">
                  <CardBody className="flex flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-sm font-medium text-ink">
                        {resource.name}
                      </h2>

                      <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-xs text-ink-muted">
                        {resource.type}
                      </span>
                    </div>

                    {resource.description ? (
                      <p className="text-xs text-ink-muted">
                        {resource.description}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                      <span>
                        {formatDate(resource.uploadedAt, i18n.language)}
                      </span>

                      {mine?.viewed ? (
                        <span className="inline-flex items-center gap-1 text-band-low">
                          <Eye className="size-3" aria-hidden="true" />
                          {t('resource.viewed')}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-1 pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const fullUrl = resolveResourceUrl(resource.url)

                          if (isFile) {
                            // Files and images are downloaded directly.
                            // They will NOT open in a new tab.
                            void triggerFileDownload(
                              fullUrl,
                              resource.name,
                            )
                          } else {
                            // Videos and regular links still open in a new tab.
                            window.open(
                              fullUrl,
                              '_blank',
                              'noopener,noreferrer',
                            )
                          }

                          if (employeeId !== null && !mine?.viewed) {
                            record.mutate({
                              empId: employeeId,
                              resourceId: resource.id,
                              viewed: true,
                              surveyCompleted: isSurvey
                                ? (mine?.surveyCompleted ?? false)
                                : false,
                            })
                          }
                        }}
                      >
                        <ActionIcon
                          className="size-3.5"
                          aria-hidden="true"
                        />

                        {t(labelKey)}
                      </Button>

                      {isSurvey && !isAdmin ? (
                        <Button
                          type="button"
                          variant={
                            mine?.surveyCompleted ? 'primary' : 'secondary'
                          }
                          size="sm"
                          disabled={
                            employeeId === null || record.isPending
                          }
                          onClick={() =>
                            employeeId !== null &&
                            record.mutate({
                              empId: employeeId,
                              resourceId: resource.id,
                              viewed: true,
                              surveyCompleted: !(
                                mine?.surveyCompleted ?? false
                              ),
                            })
                          }
                        >
                          <Check
                            className="size-3.5"
                            aria-hidden="true"
                          />

                          {mine?.surveyCompleted
                            ? t('resource.surveyDone')
                            : t('resource.markSurveyDone')}
                        </Button>
                      ) : null}

                      {isAdmin ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm(t('resource.confirmDelete'))) {
                              remove.mutate(resource.id)
                            }
                          }}
                        >
                          <Trash2
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        </Button>
                      ) : null}
                    </div>

                    {isAdmin ? (
                      <Readership
                        stats={statsByResource.get(resource.id)}
                      />
                    ) : null}
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}
      </StateBoundary>
    </div>
  )
}