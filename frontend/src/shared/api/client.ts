import { APP_MESSAGES } from '../constants/messages'
import type { AnalysisOrder, AnalysisResult } from '../types'

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true'

type SaveCorpusPayload = {
  browser_id: string
  documents: Array<{
    title: string
    content: string
  }>
}

type RunAnalysisPayload = {
  browser_id: string
  params: {
    top_n: number
    min_word_length: number
    order_by: AnalysisOrder
  }
}

type ApiEnvelope<T> = {
  status: string
  data: T
  message?: string
}

type SaveCorpusResponse = {
  browser_id: string
  documents_count: number
  message: string
}

type AnalysisResponse = {
  applied_filters: {
    top_n: number
    min_word_length: number
    order_by: AnalysisOrder
  }
  summary: AnalysisResult['summary']
  table: AnalysisResult['table']
}

const MOCK_DELAY = 1000

const mockAnalysisResponse: AnalysisResponse = {
  applied_filters: {
    top_n: 20,
    min_word_length: 3,
    order_by: 'desc',
  },
  summary: {
    documents_count: 3,
    total_words_before_filters: 5200,
    total_words_after_filters: 4200,
    unique_words: 830,
  },
  table: [
    { word: 'текст', count: 54 },
    { word: 'данные', count: 43 },
    { word: 'анализ', count: 38 },
    { word: 'слово', count: 35 },
    { word: 'корпус', count: 29 },
    { word: 'частота', count: 26 },
    { word: 'документ', count: 24 },
    { word: 'результат', count: 21 },
    { word: 'модель', count: 18 },
    { word: 'пример', count: 16 },
  ],
}

function wait(delay: number) {
  return new Promise((resolve) => window.setTimeout(resolve, delay))
}

function getApiBaseUrl() {
  if (USE_MOCK_API) {
    return ''
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

  if (!baseUrl) {
    throw new Error(APP_MESSAGES.missingApiBaseUrl)
  }

  return baseUrl.replace(/\/+$/, '')
}

async function request<T>(
  path: string,
  method: 'POST' | 'PUT',
  payload: unknown,
) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  let parsed: ApiEnvelope<T> | null = null

  try {
    parsed = (await response.json()) as ApiEnvelope<T>
  } catch {
    parsed = null
  }

  if (!response.ok) {
    throw new Error(parsed?.message || APP_MESSAGES.requestError(response.status))
  }

  if (!parsed || parsed.status !== 'success') {
    throw new Error(parsed?.message || APP_MESSAGES.invalidServerResponse)
  }

  return parsed.data
}

export function saveCorpus(payload: SaveCorpusPayload) {
  if (USE_MOCK_API) {
    return wait(MOCK_DELAY).then(
      () =>
        ({
          browser_id: payload.browser_id,
          documents_count: payload.documents.length,
          message: 'Corpus saved and tokenized',
        }) satisfies SaveCorpusResponse,
    )
  }

  return request<SaveCorpusResponse>('/corpus', 'PUT', payload)
}

export function runAnalysis(payload: RunAnalysisPayload) {
  if (USE_MOCK_API) {
    return wait(MOCK_DELAY).then(() => ({
      ...mockAnalysisResponse,
      applied_filters: {
        top_n: payload.params.top_n,
        min_word_length: payload.params.min_word_length,
        order_by: payload.params.order_by,
      },
    }))
  }

  return request<AnalysisResponse>('/analysis/run', 'POST', payload)
}
