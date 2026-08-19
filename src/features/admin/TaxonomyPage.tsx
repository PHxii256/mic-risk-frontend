import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/errors'
import { StateBoundary } from '@/components/app/StateBoundary'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Skeleton,
  Spinner,
} from '@/components/ui/primitives'
import { RISK_CATEGORIES, type Subcategory } from '@/domain/report'

import { useCategories, useDeleteSubcategory, useSaveSubcategory } from './hooks'

export function TaxonomyPage() {
  const { t } = useTranslation()
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
  const categories = useCategories()
  const remove = useDeleteSubcategory()
  const [editing, setEditing] = useState<Subcategory | 'new' | null>(null)

  // Check if categories are empty
  const hasNoCategories = !categories.data || categories.data.length === 0
  
  // Hide StateBoundary when editing while no categories exist
  const hideStateBoundary = Boolean(editing && hasNoCategories)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-ink">{t('nav.taxonomy')}</h1>
        <Button type="button" onClick={() => setEditing('new')}>
          <Plus className="size-3.5" aria-hidden="true" />
          {t('taxonomy.add')}
        </Button>
      </div>

      {editing ? (
        <SubcategoryForm
          subcategory={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {!hideStateBoundary && (
        <StateBoundary
          isLoading={categories.isPending}
          error={categories.error}
          data={categories.data}
          onRetry={() => void categories.refetch()}
          skeleton={
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          }
          isEmpty={(groups) => groups.length === 0}
        >
          {(groups) => (
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((group) => (
                <Card key={group.category}>
                  <CardHeader>
                    <CardTitle>{t(`riskCategory.${group.category}`)}</CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-1">
                    {group.subcategories.length === 0 ? (
                      <p className="text-xs text-ink-subtle">{t('state.empty')}</p>
                    ) : (
                      group.subcategories.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between gap-2 border-b border-border-subtle py-1.5 last:border-0"
                        >
                          <span className="text-sm">{isRtl ? sub.nameAr : sub.nameEn}</span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(sub)}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={remove.isPending}
                              onClick={() => {
                                if (confirm(t('taxonomy.confirmDelete'))) remove.mutate(sub.id)
                              }}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </StateBoundary>
      )}
    </div>
  )
}
function SubcategoryForm({
  subcategory,
  onClose,
}: {
  subcategory?: Subcategory
  onClose: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveSubcategory()

  const [nameEn, setNameEn] = useState(subcategory?.nameEn ?? '')
  const [nameAr, setNameAr] = useState(subcategory?.nameAr ?? '')

  const [category, setCategory] = useState<string>(subcategory?.category ?? RISK_CATEGORIES[0])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{subcategory ? t('taxonomy.edit') : t('taxonomy.add')}</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate({ id: subcategory?.id, nameEn: nameEn,nameAr: nameAr ,  category }, { onSuccess: onClose })
          }}
        >
          <Field htmlFor="sub-name" label={t('taxonomy.nameEn')} required>
            <Input
              id="sub-name"
              value={nameEn}
              aria-required="true"
              onChange={(e) => setNameEn(e.currentTarget.value)}
            />
          </Field>
          <Field htmlFor="sub-name" label={t('taxonomy.nameAr')} required>
            <Input
              id="sub-name"
              value={nameAr}
              aria-required="true"
              onChange={(e) => setNameAr(e.currentTarget.value)}
            />
          </Field>
          {/* Constrained by a database check constraint, so it is a fixed list, not free text. */}
          <Field htmlFor="sub-category" label={t('report.category')} required>
            <Select
              id="sub-category"
              value={category}
              onChange={(e) => setCategory(e.currentTarget.value)}
            >
              {RISK_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {t(`riskCategory.${value}`)}
                </option>
              ))}
            </Select>
          </Field>

          {save.isError ? (
            <p className="sm:col-span-2 rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger" role="alert">
              {save.error instanceof ApiError
                ? (save.error.detail ?? t('state.errorTitle'))
                : t('state.errorTitle')}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner /> : null}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
