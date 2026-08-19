import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The app ships in Arabic as well as English, so every direction-sensitive style has to be
 * logical (`ms-`/`me-`, `ps-`/`pe-`, `text-start`/`text-end`, `border-s`/`border-e`) rather than
 * physical. A single `ml-2` looks correct in English and wrong in Arabic, and that is exactly
 * the kind of mistake nobody notices until a reviewer opens the app in the other direction.
 *
 * This is enforced as a test because the linter has no rule for it.
 */

const SOURCE_ROOT = join(process.cwd(), 'src')

/**
 * Physical utilities that have a logical counterpart. Matched with a leading boundary and an
 * optional variant prefix, so `sm:ml-2` and `hover:pl-1` are caught too.
 */
const BANNED = [
  { pattern: /(?:^|["'\s:])(ml-|mr-)[\w./[\]-]+/g, use: 'ms-* / me-*' },
  { pattern: /(?:^|["'\s:])(pl-|pr-)[\w./[\]-]+/g, use: 'ps-* / pe-*' },
  { pattern: /(?:^|["'\s:])(left-|right-)[\w./[\]-]+/g, use: 'start-* / end-*' },
  { pattern: /(?:^|["'\s:])(border-l|border-r)(?![a-z])[\w./[\]-]*/g, use: 'border-s / border-e' },
  { pattern: /(?:^|["'\s:])(rounded-l|rounded-r)(?![a-z])[\w./[\]-]*/g, use: 'rounded-s / rounded-e' },
  { pattern: /(?:^|["'\s:])text-(left|right)(?![a-z])/g, use: 'text-start / text-end' },
] as const

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : []
  })
}

describe('RTL safety', () => {
  it('uses no physical direction utilities anywhere in src', () => {
    const violations: string[] = []

    for (const file of sourceFiles(SOURCE_ROOT)) {
      // The generated schema is machine-written and contains no styling.
      if (file.endsWith('schema.d.ts')) continue

      const contents = readFileSync(file, 'utf8')

      for (const { pattern, use } of BANNED) {
        for (const match of contents.matchAll(pattern)) {
          const line = contents.slice(0, match.index).split('\n').length
          violations.push(
            `${file.replace(process.cwd(), '.')}:${line} uses "${match[0].trim()}" — use ${use}`,
          )
        }
      }
    }

    expect(violations).toEqual([])
  })
})
