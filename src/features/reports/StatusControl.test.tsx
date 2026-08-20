import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import '@/i18n'
import type { RiskReport } from '@/domain/report'

import { StatusControl } from './StatusControl'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  actions: [] as unknown[],
}))

vi.mock('@/features/admin/hooks', () => ({
  useUpdateReportStatus: () => ({
    mutate: mocks.mutate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useActionsByReport: () => ({
    data: mocks.actions,
    isPending: false,
  }),
}))

const report = { id: 42, status: 'InReview' } as RiskReport

beforeEach(() => {
  mocks.mutate.mockReset()
  mocks.actions = []
  window.localStorage.setItem('mic-locale', 'en')
})

describe('StatusControl', () => {
  it('shows every status with the current status selected', () => {
    render(<StatusControl report={report} />)

    const select = screen.getByRole('combobox', { name: 'Status' })
    expect(select).toHaveValue('InReview')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Submitted',
      'In review',
      'Resolved',
      'Archived',
    ])
  })

  it('explains and blocks resolution when no mitigation exists', () => {
    render(<StatusControl report={report} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'Resolved' },
    })

    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Add at least one mitigation before marking this report as resolved.',
    )
  })

  it('submits resolution after a mitigation exists', () => {
    mocks.actions = [{ id: 1 }]
    render(<StatusControl report={report} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'Resolved' },
    })

    expect(mocks.mutate).toHaveBeenCalledWith('Resolved')
  })
})
