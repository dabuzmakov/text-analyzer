import { APP_MESSAGES } from '../constants/messages'
import type {
  AnalysisResponse,
  CorpusApiDocument,
  DownloadCsvParams,
  ExportIdentifier,
  FrequencyRow,
  RunAnalysisRequest,
  SaveCorpusRequest,
  SaveCorpusResponse,
} from '../types'

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true'
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/+$/, '')
const MOCK_DELAY = 1000
const MOCK_STORAGE_KEY = 'text-analyzer-mock-corpus'
const DEFAULT_CORPUS_CSV_FILE_NAME = 'statistics.csv'
const CSV_MEDIA_TYPE = 'text/csv;charset=utf-8'
const MOCK_TOTAL_WORDS_PER_DOCUMENT = 420
const MOCK_UNIQUE_WORDS = 830
const MOCK_CSV_HEADER = '\ufeffСлово,Частота'

type ApiEnvelope<T> = T & {
  status: string
  message?: string
}

type ApiErrorEnvelope = {
  detail?: string | Array<{ msg?: string }>
  message?: string
  status?: string
}

type MockCorpusStore = Record<string, CorpusApiDocument[]>

const MOCK_ANALYSIS_ROWS: FrequencyRow[] = [
  { word: 'текст', count: 54 },
  { word: 'данные', count: 43 },
  { word: 'анализ', count: 38 },
  { word: 'корпус', count: 31 },
  { word: 'документ', count: 29 },
  { word: 'частота', count: 26 },
  { word: 'слово', count: 24 },
  { word: 'таблица', count: 21 },
  { word: 'результат', count: 19 },
  { word: 'фильтр', count: 17 },
  { word: 'экспорт', count: 15 },
  { word: 'сервер', count: 13 },
]

function wait(delay: number) {
  return new Promise((resolve) => window.setTimeout(resolve, delay))
}

function getApiBaseUrl() {
  if (USE_MOCK_API) {
    return ''
  }

  if (!API_BASE_URL) {
    throw new Error(APP_MESSAGES.missingApiBaseUrl)
  }

  return API_BASE_URL
}

function getMockCorpusStore() {
  const rawValue = window.localStorage.getItem(MOCK_STORAGE_KEY)

  if (!rawValue) {
    return {} as MockCorpusStore
  }

  try {
    return JSON.parse(rawValue) as MockCorpusStore
  } catch {
    return {}
  }
}

function setMockCorpusStore(store: MockCorpusStore) {
  window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(store))
}

function getMockDocuments(browserId: string) {
  return getMockCorpusStore()[browserId] ?? []
}

function getMockRows(orderBy: 'asc' | 'desc', topN?: number) {
  const rows =
    orderBy === 'asc' ? [...MOCK_ANALYSIS_ROWS].reverse() : [...MOCK_ANALYSIS_ROWS]

  return typeof topN === 'number' ? rows.slice(0, topN) : rows
}

function buildAnalysisResponse(
  documents: CorpusApiDocument[],
  params: RunAnalysisRequest['params'],
): AnalysisResponse {
  return {
    status: 'success',
    data: {
      summary: {
        documents_count: documents.length,
        total_words: documents.length * MOCK_TOTAL_WORDS_PER_DOCUMENT,
        unique_words: MOCK_UNIQUE_WORDS,
      },
      table: getMockRows(params.order_by, params.top_n),
    },
  }
}

function buildCsvContent(identifier: ExportIdentifier, params: DownloadCsvParams) {
  const rows = getMockRows(params.order_by, params.top_n)
  const csvRows = rows.map((row) => `${row.word},${row.count}`).join('\n')

  return `${MOCK_CSV_HEADER}${csvRows ? `\n${csvRows}` : ''}`
}

function assertMockCorpusExists(browserId: string) {
  const documents = getMockDocuments(browserId)

  if (documents.length === 0) {
    throw new Error('Corpus is empty')
  }

  return documents
}

function assertMockExportTargetExists(
  identifier: ExportIdentifier,
  browserId: string,
) {
  const documents = getMockDocuments(browserId)

  if (identifier === 'corpus') {
    if (documents.length === 0) {
      throw new Error('Corpus is empty or not found')
    }

    return
  }

  if (!documents.some((item) => String(item.id) === identifier)) {
    throw new Error('Analysis result not found')
  }
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url)
  }, 0)
}

function getDefaultCsvFileName(identifier: ExportIdentifier) {
  return identifier === 'corpus'
    ? DEFAULT_CORPUS_CSV_FILE_NAME
    : `document-${identifier}.csv`
}

function getFileNameFromDisposition(
  identifier: ExportIdentifier,
  preferredFileName: string | undefined,
  contentDisposition: string | null,
) {
  if (preferredFileName) {
    return preferredFileName
  }

  const match = contentDisposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)
  const rawFileName = match?.[1]

  if (rawFileName) {
    return decodeURIComponent(rawFileName.replace(/"/g, ''))
  }

  return getDefaultCsvFileName(identifier)
}

function getApiErrorMessage(payload: ApiErrorEnvelope | null, status: number) {
  if (!payload) {
    return APP_MESSAGES.requestError(status)
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message
  }

  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail
  }

  if (Array.isArray(payload.detail)) {
    const detailMessage = payload.detail
      .map((item) => item.msg?.trim())
      .filter((message): message is string => Boolean(message))
      .join('; ')

    if (detailMessage) {
      return detailMessage
    }
  }

  return APP_MESSAGES.requestError(status)
}

function createExportQuery(params?: DownloadCsvParams) {
  if (!params) {
    return ''
  }

  const searchParams = new URLSearchParams({
    browser_id: params.browser_id,
    min_word_length: String(params.min_word_length),
    order_by: params.order_by,
  })

  if (typeof params.top_n === 'number') {
    searchParams.set('top_n', String(params.top_n))
  }

  return `?${searchParams.toString()}`
}

async function requestJson<T>(
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
    throw new Error(
      getApiErrorMessage(parsed as ApiErrorEnvelope | null, response.status),
    )
  }

  if (!parsed || parsed.status !== 'success') {
    throw new Error(parsed?.message || APP_MESSAGES.invalidServerResponse)
  }

  return parsed
}

async function requestFile(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`)

  if (!response.ok) {
    let payload: ApiErrorEnvelope | null = null

    try {
      payload = (await response.json()) as ApiErrorEnvelope
    } catch {
      payload = null
    }

    throw new Error(getApiErrorMessage(payload, response.status))
  }

  return response
}

export function saveCorpus(payload: SaveCorpusRequest) {
  if (USE_MOCK_API) {
    return wait(MOCK_DELAY).then(() => {
      const store = getMockCorpusStore()

      store[payload.browser_id] = payload.documents
      setMockCorpusStore(store)

      return {
        status: 'success',
        message: `Saved ${payload.documents.length} documents`,
      } satisfies SaveCorpusResponse
    })
  }

  return requestJson<SaveCorpusResponse>('/corpus', 'PUT', payload)
}

export function runAnalysis(payload: RunAnalysisRequest) {
  if (USE_MOCK_API) {
    return wait(MOCK_DELAY).then(() =>
      buildAnalysisResponse(
        assertMockCorpusExists(payload.browser_id),
        payload.params,
      ),
    )
  }

  return requestJson<AnalysisResponse>('/analysis/run', 'POST', payload)
}

export async function downloadCsv(
  identifier: ExportIdentifier,
  preferredFileName?: string,
  params?: DownloadCsvParams,
) {
  if (USE_MOCK_API) {
    await wait(300)

    if (!params) {
      throw new Error(APP_MESSAGES.invalidServerResponse)
    }

    assertMockExportTargetExists(identifier, params.browser_id)

    const blob = new Blob([buildCsvContent(identifier, params)], {
      type: CSV_MEDIA_TYPE,
    })

    triggerBlobDownload(blob, preferredFileName || getDefaultCsvFileName(identifier))
    return
  }

  const response = await requestFile(
    `/export/csv/${encodeURIComponent(identifier)}${createExportQuery(params)}`,
  )
  const blob = await response.blob()
  const fileName = getFileNameFromDisposition(
    identifier,
    preferredFileName,
    response.headers.get('content-disposition'),
  )

  triggerBlobDownload(blob, fileName)
}
