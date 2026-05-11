import { formatPercent } from '../../shared/utils/lexema'
import type { SeoKeywordRow, SeoNgramRow, SeoResult, SeoWordRow } from '../../types/analysis'
import type { AnalysisSettings } from '../../types/settings'
import type { ChartRow, DetailChartRow, DetailKind, DetailOrder, DetailTopN, HighlightKind } from './types'

export function translateRisk(level: string) {
  if (level === 'high') {
    return 'Высокий'
  }
  if (level === 'medium') {
    return 'Средний'
  }
  return 'Низкий'
}

export function normalizeTerm(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е')
}

export function buildHighlightSets(result: SeoResult, settings: AnalysisSettings) {
  const keywords = new Set<string>()
  const keywordPhrases: string[][] = []

  result.keywords.forEach((row) => {
    const words = termToWords(row.keyword)

    words.forEach((word) => keywords.add(word))
    if (words.length > 1) {
      keywordPhrases.push(words)
    }
  })

  const stop = new Set<string>()
  if (settings.stop_words.mode === 'default' || settings.stop_words.mode === 'default_custom') {
    result.lexicon?.stop_words.forEach((word) => stop.add(normalizeTerm(word)))
  }
  if (settings.stop_words.mode === 'custom' || settings.stop_words.mode === 'default_custom') {
    settings.stop_words.custom.forEach((word) => stop.add(normalizeTerm(word)))
  }

  const water = new Set<string>()
  const waterPhrases: string[][] = []
  const waterMarkerRows = result.water.markers ?? result.water.top_markers

  waterMarkerRows.forEach((row) => {
    const words = termToWords(row.marker)

    if (words.length === 1) {
      water.add(words[0])
    } else if (words.length > 1) {
      waterPhrases.push(words)
    }
  })

  const mixed = new Set(result.mixed_alphabet_words.map((row) => normalizeTerm(row.word)))

  return {
    keywords,
    keywordPhrases: sortPhrasesByLength(keywordPhrases),
    mixed,
    stop,
    water,
    waterPhrases: sortPhrasesByLength(waterPhrases),
  }
}

type HighlightSets = ReturnType<typeof buildHighlightSets>

export function buildPartHighlights(
  parts: string[],
  sets: HighlightSets,
  enabled: Record<HighlightKind, boolean>,
) {
  const highlights = new Map<number, Exclude<HighlightKind, 'mixed'>>()
  const wordIndexes = parts
    .map((part, index) => ({ index, normalized: normalizeTerm(part) }))
    .filter(({ normalized }) => /^[\p{L}]+(?:[-'][\p{L}]+)*$/u.test(normalized))

  if (enabled.keywords) {
    applyPhraseHighlights(highlights, wordIndexes, sets.keywordPhrases, 'keywords')
  }
  if (enabled.water) {
    applyPhraseHighlights(highlights, wordIndexes, sets.waterPhrases, 'water')
  }

  wordIndexes.forEach(({ index, normalized }) => {
    if (highlights.has(index)) {
      return
    }

    if (enabled.keywords && sets.keywords.has(normalized)) {
      highlights.set(index, 'keywords')
    } else if (enabled.water && sets.water.has(normalized)) {
      highlights.set(index, 'water')
    } else if (enabled.stop && sets.stop.has(normalized)) {
      highlights.set(index, 'stop')
    }
  })

  return highlights
}

function termToWords(value: string) {
  return normalizeTerm(value).match(/[\p{L}]+(?:[-'][\p{L}]+)*/gu) ?? []
}

function sortPhrasesByLength(phrases: string[][]) {
  return phrases.sort((first, second) => second.length - first.length)
}

function applyPhraseHighlights(
  highlights: Map<number, Exclude<HighlightKind, 'mixed'>>,
  wordIndexes: Array<{ index: number; normalized: string }>,
  phrases: string[][],
  kind: Exclude<HighlightKind, 'mixed'>,
) {
  phrases.forEach((phrase) => {
    for (let position = 0; position <= wordIndexes.length - phrase.length; position += 1) {
      const matches = phrase.every((word, offset) => wordIndexes[position + offset]?.normalized === word)

      if (matches) {
        phrase.forEach((_, offset) => {
          const partIndex = wordIndexes[position + offset]?.index

          if (partIndex !== undefined && !highlights.has(partIndex)) {
            highlights.set(partIndex, kind)
          }
        })
      }
    }
  })
}

export function wordRowsToDisplay(rows: SeoWordRow[]): ChartRow[] {
  return rows.map((row) => ({
    label: row.word,
    value: row.count,
    meta: formatPercent(row.density),
  }))
}

export function wordsToChartRows(rows: SeoWordRow[]): ChartRow[] {
  return wordRowsToDisplay(rows)
}

export function ngramRowsToDisplay(rows: SeoNgramRow[]): ChartRow[] {
  return rows.map((row) => ({
    label: row.phrase,
    value: row.count,
    meta: formatPercent(row.density),
  }))
}

export function ngramRowsToChartRows(rows: SeoNgramRow[]): ChartRow[] {
  return ngramRowsToDisplay(rows)
}

export function keywordRowsToChartRows(rows: SeoKeywordRow[]): ChartRow[] {
  return rows.map((row) => ({
    label: row.keyword,
    value: row.count,
    meta: row.count > 0 ? 'В тексте' : 'Не найдено',
  }))
}

export function getDetailConfig(detail: DetailKind) {
  const configs: Record<DetailKind, { title: string; description: string }> = {
    keywords: {
      title: 'Ключевые слова и фразы',
      description: 'Расширенный частотный чарт по всем элементам',
    },
    ngrams: {
      title: 'Топ N-грамм',
      description: 'Расширенный частотный чарт по всем элементам',
    },
    words: {
      title: 'Топ слов',
      description: 'Расширенный частотный чарт по всем элементам',
    },
  }

  return configs[detail]
}

export function getDetailChartRows(
  detail: DetailKind,
  result: SeoResult,
  filters: { minLength: number; order: DetailOrder; topN: DetailTopN },
): DetailChartRow[] {
  const limitRows = (rows: DetailChartRow[]) => filters.topN === 'all' ? rows : rows.slice(0, filters.topN)

  if (detail === 'words') {
    return limitRows(sortDetailRows(
      result.words
        .filter((row) => row.word.length >= filters.minLength)
        .map((row) => ({ label: row.word, count: row.count, density: row.density })),
      filters.order,
    ))
  }

  if (detail === 'ngrams') {
    return limitRows(sortDetailRows(
      result.ngrams
        .filter((row) => row.phrase.length >= filters.minLength)
        .map((row) => ({ label: row.phrase, count: row.count, density: row.density })),
      filters.order,
    ))
  }

  return limitRows(sortDetailRows(
    result.keywords
      .filter((row) => row.keyword.length >= filters.minLength)
      .map((row) => ({ label: row.keyword, count: row.count, density: row.density, status: row.status })),
    filters.order,
  ))
}

export function detailRowsToChartRows(rows: DetailChartRow[]): ChartRow[] {
  return rows.map((row) => ({
    label: row.label,
    value: row.count,
    meta: formatPercent(row.density),
  }))
}

export function detailMarkdownHeaders(detail: DetailKind) {
  return detail === 'keywords'
    ? ['Фраза', 'Частота', 'Плотность', 'Статус']
    : ['Фраза', 'Частота', 'Плотность']
}

export function detailRowsToMarkdown(detail: DetailKind, rows: DetailChartRow[]): Array<Array<string | number>> {
  return rows.map((row) => detail === 'keywords'
    ? [row.label, row.count, formatPercent(row.density), keywordStatusLabel(row)]
    : [row.label, row.count, formatPercent(row.density)])
}

export function keywordStatusLabel(row: DetailChartRow) {
  if (row.count > 0) {
    return 'В тексте'
  }

  return 'Не найдено'
}

export function copyMarkdownTable(title: string, headers: string[], rows: Array<Array<string | number>>) {
  const table = [
    `### ${title}`,
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')

  void navigator.clipboard?.writeText(table)
}

export function downloadChartPng(title: string, rows: ChartRow[]) {
  const canvas = window.document.createElement('canvas')
  const width = 1200
  const height = 720
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#111827'
  context.font = '700 34px Arial'
  context.fillText(title, 56, 66)
  context.font = '500 22px Arial'

  const max = Math.max(1, ...rows.map((row) => row.value))
  rows.slice(0, 12).forEach((row, index) => {
    const y = 124 + index * 46
    const barWidth = Math.max(8, (row.value / max) * 620)
    context.fillStyle = '#111827'
    context.fillText(row.label.slice(0, 34), 56, y + 20)
    context.fillStyle = '#e7edf3'
    context.fillRect(380, y, 650, 18)
    context.fillStyle = '#11a663'
    context.fillRect(380, y, barWidth, 18)
    context.fillStyle = '#111827'
    context.fillText(`${row.value}${row.meta ? ` (${row.meta})` : ''}`, 1050, y + 18)
  })

  const link = window.document.createElement('a')
  link.download = `${title.toLowerCase().replace(/\s+/g, '_')}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function sortDetailRows<T extends DetailChartRow>(rows: T[], order: DetailOrder) {
  return [...rows].sort((left, right) => {
    if (order === 'count_asc') {
      return left.count - right.count
    }
    return right.count - left.count
  })
}
