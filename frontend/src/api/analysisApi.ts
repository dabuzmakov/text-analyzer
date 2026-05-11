import { requestJson, USE_MOCK_API } from './http'
import type { LastAnalysisResult, SeoResult } from '../types/analysis'
import type { AnalysisSettings } from '../types/settings'

export async function runSeoAnalysis(
  browserId: string,
  documentIds: string[],
  params: AnalysisSettings,
) {
  if (USE_MOCK_API) {
    const { runMockSeoAnalysis } = await import('./mockApi')
    return runMockSeoAnalysis(browserId, documentIds, params)
  }

  return requestJson<LastAnalysisResult<SeoResult>>('/analysis/seo', {
    method: 'POST',
    body: JSON.stringify({
      browser_id: browserId,
      document_ids: documentIds,
      params,
    }),
  })
}
