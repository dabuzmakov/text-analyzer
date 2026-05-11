import { createQuery, downloadBlob, downloadResponseBlob, requestBlob, USE_MOCK_API } from './http'
import type { SeoTableExportType } from '../types/analysis'

const csvNames: Record<SeoTableExportType, string> = {
  words: 'seo_words.csv',
  ngrams: 'seo_ngrams.csv',
  keywords: 'seo_keywords.csv',
  spam: 'seo_spam.csv',
  water: 'seo_water.csv',
  mixed: 'seo_mixed.csv',
}

export async function downloadSeoCsv(type: SeoTableExportType, browserId: string) {
  if (USE_MOCK_API) {
    const { downloadMockSeoCsv } = await import('./mockApi')
    const blob = await downloadMockSeoCsv(browserId, type)
    downloadBlob(blob, csvNames[type])
    return
  }

  const response = await requestBlob(
    `/export/csv/seo/${type}${createQuery({ browser_id: browserId })}`,
  )
  await downloadResponseBlob(response, csvNames[type])
}

export async function downloadSeoZip(browserId: string) {
  if (USE_MOCK_API) {
    const { downloadMockSeoZip } = await import('./mockApi')
    const blob = await downloadMockSeoZip(browserId)
    downloadBlob(blob, 'seo_report.zip')
    return
  }

  const response = await requestBlob(`/export/zip/seo${createQuery({ browser_id: browserId })}`)
  await downloadResponseBlob(response, 'seo_report.zip')
}
