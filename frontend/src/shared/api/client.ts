import { APP_MESSAGES } from '../constants/messages'
import type {
  AnalysisResponse,
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

type ApiEnvelope<T> = T & {
  status: string
  message?: string
}

type ApiErrorEnvelope = {
  detail?: string | Array<{ msg?: string }>
  message?: string
  status?: string
}

const MOCK_ANALYSIS_WORDS = [
  'текст',
  'данные',
  'анализ',
  'корпус',
  'документ',
  'частота',
  'слово',
  'таблица',
  'результат',
  'фильтр',
  'загрузка',
  'создание',
  'экспорт',
  'сохранение',
  'интерфейс',
  'панель',
  'выборка',
  'лексема',
  'модуль',
  'форма',
  'кнопка',
  'строка',
  'колонка',
  'параметр',
  'значение',
  'сортировка',
  'минимум',
  'максимум',
  'подсчёт',
  'отчёт',
  'файл',
  'проводник',
  'редактор',
  'сводка',
  'метрика',
  'частотность',
  'токен',
  'норма',
  'поиск',
  'проверка',
  'адаптация',
  'экран',
  'монитор',
  'планшет',
  'телефон',
  'прокрутка',
  'заголовок',
  'область',
  'макет',
  'контент',
  'позиция',
  'раздел',
  'граница',
  'отступ',
  'радиус',
  'фон',
  'тень',
  'состояние',
  'ошибка',
  'успех',
  'запрос',
  'ответ',
  'сервер',
  'клиент',
  'массив',
  'объект',
  'счётчик',
  'словарь',
  'вывод',
  'пример',
  'тест',
  'сценарий',
  'разметка',
  'компонент',
  'приложение',
  'проект',
  'логика',
  'наблюдение',
  'контроль',
  'итог',
]

const MOCK_ANALYSIS_TABLE: FrequencyRow[] = MOCK_ANALYSIS_WORDS.map((word, index) => ({
  word,
  count: Math.max(3, 96 - index),
}))

const MOCK_ANALYSIS_RESPONSE: AnalysisResponse = {
  status: 'success',
  data: {
    summary: {
      documents_count: 3,
      total_words: 12840,
      unique_words: MOCK_ANALYSIS_TABLE.length,
    },
    table: MOCK_ANALYSIS_TABLE,
  },
}

const MOCK_CORPUS_CSV = [
  'word,count',
  'текст,54',
  'данные,43',
  'анализ,38',
].join('\n')

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

function createMockCsvContent(identifier: string) {
  if (identifier === 'corpus') {
    return MOCK_CORPUS_CSV
  }

  return ['word,count', `документ_${identifier},12`, 'пример,7'].join('\n')
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

function getFileNameFromDisposition(
  identifier: string,
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

  return identifier === 'corpus' ? 'statistics.csv' : `document-${identifier}.csv`
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
    throw new Error(
      getApiErrorMessage(parsed as ApiErrorEnvelope | null, response.status),
    )
  }

  if (!parsed || parsed.status !== 'success') {
    throw new Error(parsed?.message || APP_MESSAGES.invalidServerResponse)
  }

  return parsed
}

export function saveCorpus(payload: SaveCorpusRequest) {
  if (USE_MOCK_API) {
    return wait(MOCK_DELAY).then(
      () =>
        ({
          status: 'success',
          message: `Saved ${payload.documents.length} documents`,
        }) satisfies SaveCorpusResponse,
    )
  }

  return request<SaveCorpusResponse>('/corpus', 'PUT', payload)
}

export function runAnalysis(payload: RunAnalysisRequest) {
  if (USE_MOCK_API) {
    return wait(MOCK_DELAY).then(() => MOCK_ANALYSIS_RESPONSE)
  }

  return request<AnalysisResponse>('/analysis/run', 'POST', payload)
}

export async function downloadCsv(identifier: string, preferredFileName?: string) {
  if (USE_MOCK_API) {
    await wait(300)

    const content = createMockCsvContent(identifier)
    const blob = new Blob([content], {
      type: 'text/csv;charset=utf-8',
    })

    triggerBlobDownload(
      blob,
      preferredFileName ||
        (identifier === 'corpus' ? 'statistics.csv' : `document-${identifier}.csv`),
    )

    return
  }

  const response = await fetch(
    `${getApiBaseUrl()}/export/csv/${encodeURIComponent(identifier)}`,
  )

  if (!response.ok) {
    let payload: ApiErrorEnvelope | null = null

    try {
      payload = (await response.json()) as ApiErrorEnvelope
    } catch {
      payload = null
    }

    throw new Error(getApiErrorMessage(payload, response.status))
  }

  const blob = await response.blob()
  const fileName = getFileNameFromDisposition(
    identifier,
    preferredFileName,
    response.headers.get('content-disposition'),
  )

  triggerBlobDownload(blob, fileName)
}
