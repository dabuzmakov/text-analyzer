import type {
  LastAnalysisResult,
  SeoKeywordRow,
  SeoNgramRow,
  SeoResult,
  SeoSpamWarning,
  SeoStructure,
  SeoTableExportType,
  SeoWordRow,
} from '../types/analysis'
import type { AppStatePayload } from '../types/api'
import type { DocumentItem, DocumentPayload, DocumentUpdatePayload } from '../types/documents'
import { DEFAULT_ANALYSIS_SETTINGS, type AnalysisSettings } from '../types/settings'

type MockScenario = 'empty' | 'documents' | 'seo_done' | 'stale'

interface MockClientState {
  documents: DocumentItem[]
  settings: AnalysisSettings
  last_results: AppStatePayload['last_results']
}

const MOCK_DELAY = Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 250)
const MOCK_SCENARIO = (import.meta.env.VITE_MOCK_SCENARIO ?? 'seo_done') as MockScenario
const STORAGE_KEY = 'lexema_mock_api_state'
const BOOTSTRAP_KEY = 'lexema_mock_api_bootstrap'

const demoDocuments: DocumentItem[] = [
  createMockDocument(
    'doc-1',
    'article-seo.txt',
    'SEO анализ текста помогает найти ключевые слова, оценить водность текста и снизить риск переспама. Купить ноутбук можно после сравнения характеристик, цены и отзывов. Игровой ноутбук должен иметь мощный процессор, видеокарту, SSD накопитель и хороший экран. Контент маркетинг требует понятной структуры, тематических фраз и регулярной оптимизации.',
    '2026-05-03T08:40:00.000Z',
  ),
  createMockDocument(
    'doc-2',
    'competitors-notes.txt',
    'Конкуренты используют ключевые слова купить ноутбук, игровой ноутбук, ноутбук для учебы и обзор ноутбуков. В тексте есть водные конструкции, например в целом и на самом деле. Также встречается слово cайт со смешанной раскладкой.',
    '2026-05-04T11:18:00.000Z',
  ),
  createMockDocument(
    'doc-3',
    'landing-copy.txt',
    'Лендинг сервиса анализа текстов объясняет пользу продукта для редакторов и SEO специалистов. Важно показать экспорт CSV ZIP, Markdown копирование, проверку частотности и рекомендации перед публикацией.',
    '2026-05-05T14:25:00.000Z',
  ),
]

const demoSettings: AnalysisSettings = {
  stop_words: {
    mode: 'default_custom',
    custom: ['сайт', 'http', 'https', 'www'],
  },
  keywords: [
    'ноутбук',
    'купить ноутбук',
    'игровой ноутбук',
    'seo анализ текста',
    'ноутбук для учебы',
  ],
  lemmatization: true,
  ngrams: {
    sizes: [2, 3],
  },
  spam: {
    threshold_percent: 6,
  },
}

const defaultStopWords = new Set([
  'а',
  'без',
  'бы',
  'в',
  'во',
  'для',
  'до',
  'и',
  'или',
  'как',
  'к',
  'на',
  'не',
  'но',
  'о',
  'от',
  'по',
  'при',
  'с',
  'так',
  'то',
  'у',
  'что',
  'это',
])

const waterMarkers = new Set([
  'это',
  'также',
  'важно',
  'например',
  'в целом',
  'на самом деле',
])

const mixedMap: Record<string, string> = {
  a: 'а',
  c: 'с',
  e: 'е',
  o: 'о',
  p: 'р',
  x: 'х',
  y: 'у',
  k: 'к',
  m: 'м',
}

export function getMockAppState(browserId: string) {
  return wait().then(() => getClientState(browserId))
}

export function getMockDocuments(browserId: string) {
  return wait().then(() => getClientState(browserId).documents)
}

export function createMockDocumentApi(browserId: string, payload: DocumentPayload) {
  return wait().then(() => {
    const state = getClientState(browserId)

    if (state.documents.length >= 30) {
      throw new Error('DOCUMENT_LIMIT_REACHED')
    }

    const now = new Date().toISOString()
    const document = createMockDocument(
      payload.client_document_id || createId(),
      payload.title,
      payload.content,
      now,
    )

    state.documents = [document, ...state.documents]
    invalidateSeo(state, 'Документы изменены')
    setClientState(browserId, state)

    return document
  })
}

export function updateMockDocumentApi(
  browserId: string,
  documentId: string,
  payload: DocumentUpdatePayload,
) {
  return wait().then(() => {
    const state = getClientState(browserId)
    const current = state.documents.find((document) => document.id === documentId)

    if (!current) {
      throw new Error('DOCUMENT_NOT_FOUND')
    }

    const updated = createMockDocument(
      current.id,
      payload.title ?? current.title,
      payload.content ?? current.content,
      current.created_at ?? new Date().toISOString(),
      new Date().toISOString(),
    )

    state.documents = state.documents.map((document) =>
      document.id === documentId ? updated : document,
    )
    invalidateSeo(state, 'Документы изменены')
    setClientState(browserId, state)

    return updated
  })
}

export function deleteMockDocumentApi(browserId: string, documentId: string) {
  return wait().then(() => {
    const state = getClientState(browserId)
    const nextDocuments = state.documents.filter((document) => document.id !== documentId)

    if (nextDocuments.length === state.documents.length) {
      throw new Error('DOCUMENT_NOT_FOUND')
    }

    state.documents = nextDocuments
    invalidateSeo(state, 'Документы изменены')
    setClientState(browserId, state)

    return { message: 'Document deleted' }
  })
}

export function getMockSettings(browserId: string) {
  return wait().then(() => getClientState(browserId).settings)
}

export function saveMockSettings(browserId: string, settings: AnalysisSettings) {
  return wait().then(() => {
    const state = getClientState(browserId)
    state.settings = normalizeSettings(settings)
    invalidateSeo(state, 'Параметры анализа изменены')
    setClientState(browserId, state)

    return state.settings
  })
}

export function runMockSeoAnalysis(
  browserId: string,
  documentIds: string[],
  settings: AnalysisSettings,
) {
  return wait().then(() => {
    const state = getClientState(browserId)
    const selectedDocuments = documentIds.length
      ? state.documents.filter((document) => documentIds.includes(document.id))
      : state.documents

    if (selectedDocuments.length === 0) {
      throw new Error('DOCUMENTS_NOT_FOUND')
    }

    const normalizedSettings = normalizeSettings(settings)
    const result = buildSeoResult(selectedDocuments, normalizedSettings)
    const lastResult: LastAnalysisResult<SeoResult> = {
      analysis_type: 'seo',
      selected_document_ids: selectedDocuments.map((document) => document.id),
      params_snapshot: normalizedSettings,
      result,
      is_actual: true,
      invalidation_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    state.settings = normalizedSettings
    state.last_results.seo = lastResult
    setClientState(browserId, state)

    return lastResult
  })
}

export function downloadMockSeoCsv(browserId: string, type: SeoTableExportType) {
  return wait().then(() => {
    const result = requireSeoResult(browserId)
    const { headers, rows } = tableToCsv(type, result)
    const csv = toCsv(headers, rows)

    return new Blob([csv], { type: 'text/csv;charset=utf-8' })
  })
}

export function downloadMockSeoZip(browserId: string) {
  return wait().then(() => {
    const result = requireSeoResult(browserId)
    const files = (['words', 'ngrams', 'keywords', 'spam', 'water', 'mixed'] as SeoTableExportType[])
      .map((type) => {
        const { headers, rows, fileName } = tableToCsv(type, result)
        return {
          name: fileName,
          content: toCsv(headers, rows),
        }
      })

    return createZipBlob(files)
  })
}

export function resetMockApi(browserId: string, scenario: MockScenario = MOCK_SCENARIO) {
  const store = getStore()
  delete store[browserId]
  setStore(store)
  window.localStorage.removeItem(`${BOOTSTRAP_KEY}:${browserId}`)
  return getClientState(browserId, scenario)
}

function getClientState(browserId: string, scenario = MOCK_SCENARIO): MockClientState {
  const store = getStore()
  const bootstrapKey = `${BOOTSTRAP_KEY}:${browserId}`

  if (!store[browserId] || window.localStorage.getItem(bootstrapKey) !== scenario) {
    store[browserId] = createScenarioState(scenario)
    setStore(store)
    window.localStorage.setItem(bootstrapKey, scenario)
  }

  return structuredCloneSafe(store[browserId])
}

function setClientState(browserId: string, state: MockClientState) {
  const store = getStore()
  store[browserId] = state
  setStore(store)
}

function getStore(): Record<string, MockClientState> {
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as Record<string, MockClientState>
  } catch {
    return {}
  }
}

function setStore(store: Record<string, MockClientState>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function createScenarioState(scenario: MockScenario): MockClientState {
  const documents = scenario === 'empty' ? [] : demoDocuments
  const settings = scenario === 'empty' ? DEFAULT_ANALYSIS_SETTINGS : demoSettings
  const state: MockClientState = {
    documents,
    settings,
    last_results: {
      seo: null,
      compare: null,
      spelling: null,
    },
  }

  if (scenario === 'seo_done' || scenario === 'stale') {
    const result = buildSeoResult(documents, settings)
    state.last_results.seo = {
      analysis_type: 'seo',
      selected_document_ids: documents.map((document) => document.id),
      params_snapshot: settings,
      result,
      is_actual: scenario !== 'stale',
      invalidation_reason: scenario === 'stale' ? 'Документы или параметры были изменены' : null,
      created_at: '2026-05-05T15:00:00.000Z',
      updated_at: '2026-05-05T15:00:00.000Z',
    }
  }

  return state
}

function createMockDocument(
  id: string,
  title: string,
  content: string,
  createdAt: string,
  updatedAt = createdAt,
): DocumentItem {
  return {
    id,
    client_document_id: id,
    database_id: Math.abs(hashText(id)),
    title,
    content,
    char_count: content.length,
    raw_word_count: tokenize(content).length,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function buildSeoResult(documents: DocumentItem[], settings: AnalysisSettings): SeoResult {
  const text = documents.map((document) => document.content).join('\n')
  const allWords = tokenize(text)
  const originalWords = tokenize(text, false)
  const stopWords = getStopWords(settings)
  const filteredWords = allWords.filter((word) => !stopWords.has(word))
  const totalWords = Math.max(1, allWords.length)
  const filteredTotal = Math.max(1, filteredWords.length)
  const keywordTerms = normalizeTerms(settings.keywords)
  const wordCounter = countItems(filteredWords)
  const rawWordCounter = countItems(allWords)
  const ngramCounter = countNgrams(filteredWords, settings.ngrams.sizes)
  const rawNgramCounter = countNgrams(allWords, [2, 3])

  const words: SeoWordRow[] = Array.from(wordCounter.entries())
    .map(([word, count]) => ({
      word,
      count,
      density: round(count / filteredTotal * 100),
      length: word.length,
      is_keyword: keywordTerms.includes(word),
    }))
    .sort((left, right) => right.count - left.count)

  const totalNgrams = Math.max(1, Array.from(ngramCounter.values()).reduce((sum, value) => sum + value, 0))
  const ngrams: SeoNgramRow[] = Array.from(ngramCounter.entries())
    .map(([key, count]) => {
      const [size, phrase] = key.split(':')
      return {
        phrase,
        size: Number(size),
        count,
        density: round(count / totalNgrams * 100),
        is_keyword: keywordTerms.includes(phrase),
      }
    })
    .sort((left, right) => right.count - left.count)

  const keywords = keywordTerms.map((keyword) => {
    const size = keyword.split(' ').length
    const count = size === 1
      ? rawWordCounter.get(keyword) ?? 0
      : rawNgramCounter.get(`${size}:${keyword}`) ?? 0
    const density = round(count / totalWords * 100)

    return {
      keyword,
      type: size === 1 ? 'word' : 'ngram',
      count,
      density,
      status: getKeywordStatus(count, density, settings.spam.threshold_percent),
    } satisfies SeoKeywordRow
  })

  const spamWarnings: SeoSpamWarning[] = [
    ...words
      .filter((row) => row.density >= settings.spam.threshold_percent)
      .map((row) => ({
        item: row.word,
        type: 'word',
        count: row.count,
        density: row.density,
        threshold: settings.spam.threshold_percent,
        status: row.density >= settings.spam.threshold_percent * 1.5 ? 'spam' : 'high',
      })),
    ...ngrams
      .filter((row) => row.density >= settings.spam.threshold_percent)
      .map((row) => ({
        item: row.phrase,
        type: 'ngram',
        count: row.count,
        density: row.density,
        threshold: settings.spam.threshold_percent,
        status: row.density >= settings.spam.threshold_percent * 1.5 ? 'spam' : 'high',
      })),
  ]

  const waterCounter = countWater(allWords, text)
  const waterUnits = Array.from(waterCounter.values()).reduce((sum, value) => sum + value, 0)
  const waterPercent = round(waterUnits / totalWords * 100)
  const mixedCounter = countItems(
    originalWords
      .filter(hasMixedAlphabet)
      .map((word) => normalizeWord(word)),
  )
  const mixed = Array.from(mixedCounter.entries()).map(([word, count]) => ({
    word,
    count,
    suggestion: suggestMixedWord(word),
  }))
  const keywordsFound = keywords.filter((keyword) => keyword.count > 0).length

  const recommendations = buildRecommendations(keywords, spamWarnings, waterPercent, mixed.length)
  const structure = buildStructure(text)

  return {
    summary: {
      documents_count: documents.length,
      total_words: allWords.length,
      unique_words: new Set(allWords).size,
      keywords_total: keywordTerms.length,
      keywords_found: keywordsFound,
      keywords_missing: Math.max(0, keywordTerms.length - keywordsFound),
      spam_warnings_count: spamWarnings.length,
      water_percent: waterPercent,
      mixed_alphabet_count: mixed.length,
      spam_level: spamWarnings.length > 2 ? 'high' : spamWarnings.length > 0 ? 'medium' : 'low',
      keyword_coverage_percent: keywordTerms.length ? round(keywordsFound / keywordTerms.length * 100) : 0,
    },
    words,
    ngrams,
    keywords,
    spam_warnings: spamWarnings,
    water: {
      percent: waterPercent,
      level: waterPercent > 45 ? 'high' : waterPercent > 25 ? 'medium' : 'low',
      water_units_count: waterUnits,
      total_words: allWords.length,
      markers: Array.from(waterCounter.entries())
        .sort((left, right) => right[1] - left[1])
        .map(([marker, count]) => ({ marker, count })),
      top_markers: Array.from(waterCounter.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([marker, count]) => ({ marker, count })),
    },
    mixed_alphabet_words: mixed,
    structure,
    recommendations,
    lexicon: {
      stop_words: Array.from(stopWords),
      water_markers: Array.from(waterMarkers),
    },
    charts: {
      top_words: words.slice(0, 12).map((row) => ({ label: row.word, value: row.count })),
      top_ngrams: ngrams.slice(0, 12).map((row) => ({ label: row.phrase, value: row.count })),
      keyword_coverage: { found: keywordsFound, total: keywordTerms.length },
      water: { percent: waterPercent, level: waterPercent > 45 ? 'high' : waterPercent > 25 ? 'medium' : 'low' },
      spam: {
        count: spamWarnings.length,
        level: spamWarnings.length > 2 ? 'high' : spamWarnings.length > 0 ? 'medium' : 'low',
      },
      structure: {
        paragraph_share: structure.paragraphs.map((paragraph) => ({ label: `Абзац ${paragraph.index}`, value: paragraph.percent_of_text })),
        paragraph_words: structure.paragraphs.map((paragraph) => ({ label: `Абзац ${paragraph.index}`, value: paragraph.words_count })),
        sentence_words: structure.paragraphs.map((paragraph) => ({
          label: `Абзац ${paragraph.index}`,
          value: paragraph.sentences_count ? round(paragraph.words_count / paragraph.sentences_count) : 0,
        })),
      },
    },
  }
}

function normalizeSettings(settings: AnalysisSettings): AnalysisSettings {
  return {
    stop_words: {
      mode: settings.stop_words.mode,
      custom: normalizeTerms(settings.stop_words.custom),
    },
    keywords: normalizeTerms(settings.keywords),
    lemmatization: settings.lemmatization,
    ngrams: {
      sizes: Array.from(new Set(settings.ngrams.sizes.filter((size) => size === 2 || size === 3))).sort(),
    },
    spam: {
      threshold_percent: Math.max(0, Number(settings.spam.threshold_percent) || 0),
    },
  }
}

function invalidateSeo(state: MockClientState, reason: string) {
  if (state.last_results.seo) {
    state.last_results.seo = {
      ...state.last_results.seo,
      is_actual: false,
      invalidation_reason: reason,
      updated_at: new Date().toISOString(),
    }
  }
}

function requireSeoResult(browserId: string) {
  const result = getClientState(browserId).last_results.seo?.result

  if (!result) {
    throw new Error('ANALYSIS_NOT_FOUND')
  }

  return result
}

function tableToCsv(type: SeoTableExportType, result: SeoResult) {
  if (type === 'words') {
    return {
      fileName: 'seo_words.csv',
      headers: ['Слово', 'Частота', 'Плотность', 'Длина', 'Ключ'],
      rows: result.words.map((row) => [row.word, row.count, row.density, row.length, row.is_keyword ? 'да' : 'нет']),
    }
  }

  if (type === 'ngrams') {
    return {
      fileName: 'seo_ngrams.csv',
      headers: ['Фраза', 'Размер', 'Частота', 'Плотность', 'Ключ'],
      rows: result.ngrams.map((row) => [row.phrase, row.size, row.count, row.density, row.is_keyword ? 'да' : 'нет']),
    }
  }

  if (type === 'keywords') {
    return {
      fileName: 'seo_keywords.csv',
      headers: ['Ключ', 'Тип', 'Частота', 'Плотность', 'Статус'],
      rows: result.keywords.map((row) => [row.keyword, row.type, row.count, row.density, row.status]),
    }
  }

  if (type === 'spam') {
    return {
      fileName: 'seo_spam.csv',
      headers: ['Единица', 'Тип', 'Частота', 'Плотность', 'Порог', 'Статус'],
      rows: result.spam_warnings.map((row) => [row.item, row.type, row.count, row.density, row.threshold, row.status]),
    }
  }

  if (type === 'water') {
    return {
      fileName: 'seo_water.csv',
      headers: ['Показатель', 'Значение'],
      rows: [
        ['percent', result.water.percent],
        ['level', result.water.level],
        ['water_units_count', result.water.water_units_count],
        ['total_words', result.water.total_words],
        ...result.water.top_markers.map((row) => [`marker:${row.marker}`, row.count]),
      ],
    }
  }

  return {
    fileName: 'seo_mixed.csv',
    headers: ['Слово', 'Частота', 'Предложение'],
    rows: result.mixed_alphabet_words.map((row) => [row.word, row.count, row.suggestion]),
  }
}

function toCsv(headers: string[], rows: Array<Array<string | number | boolean>>) {
  const escape = (value: string | number | boolean) => `"${String(value).replace(/"/g, '""')}"`
  return [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n')
}

function createZipBlob(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name)
    const data = encoder.encode(file.content)
    const crc = crc32(data)
    const localHeader = createLocalFileHeader(nameBytes, data.length, crc)
    const centralHeader = createCentralDirectoryHeader(nameBytes, data.length, crc, offset)

    localParts.push(localHeader, nameBytes, data)
    centralParts.push(centralHeader, nameBytes)
    offset += localHeader.length + nameBytes.length + data.length
  })

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const endRecord = createEndOfCentralDirectory(files.length, centralSize, offset)

  return new Blob([...localParts, ...centralParts, endRecord].map(toBlobPart), {
    type: 'application/zip',
  })
}

function toBlobPart(part: Uint8Array) {
  const buffer = new ArrayBuffer(part.byteLength)
  new Uint8Array(buffer).set(part)
  return buffer
}

function createLocalFileHeader(nameBytes: Uint8Array, size: number, crc: number) {
  const header = new Uint8Array(30)
  const view = new DataView(header.buffer)

  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, 0, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, 0, true)
  view.setUint32(14, crc, true)
  view.setUint32(18, size, true)
  view.setUint32(22, size, true)
  view.setUint16(26, nameBytes.length, true)
  view.setUint16(28, 0, true)

  return header
}

function createCentralDirectoryHeader(
  nameBytes: Uint8Array,
  size: number,
  crc: number,
  offset: number,
) {
  const header = new Uint8Array(46)
  const view = new DataView(header.buffer)

  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(8, 0, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, 0, true)
  view.setUint16(14, 0, true)
  view.setUint32(16, crc, true)
  view.setUint32(20, size, true)
  view.setUint32(24, size, true)
  view.setUint16(28, nameBytes.length, true)
  view.setUint16(30, 0, true)
  view.setUint16(32, 0, true)
  view.setUint16(34, 0, true)
  view.setUint16(36, 0, true)
  view.setUint32(38, 0, true)
  view.setUint32(42, offset, true)

  return header
}

function createEndOfCentralDirectory(fileCount: number, centralSize: number, centralOffset: number) {
  const header = new Uint8Array(22)
  const view = new DataView(header.buffer)

  view.setUint32(0, 0x06054b50, true)
  view.setUint16(4, 0, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, fileCount, true)
  view.setUint16(10, fileCount, true)
  view.setUint32(12, centralSize, true)
  view.setUint32(16, centralOffset, true)
  view.setUint16(20, 0, true)

  return header
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff

  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
  }

  return (crc ^ 0xffffffff) >>> 0
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  return value >>> 0
})

function getStopWords(settings: AnalysisSettings) {
  const custom = new Set(normalizeTerms(settings.stop_words.custom))

  if (settings.stop_words.mode === 'off') {
    return new Set<string>()
  }

  if (settings.stop_words.mode === 'custom') {
    return custom
  }

  if (settings.stop_words.mode === 'default_custom') {
    return new Set([...defaultStopWords, ...custom])
  }

  return defaultStopWords
}

function tokenize(text: string, normalize = true) {
  const words = text.match(/[A-Za-zА-Яа-яЁё]+(?:[-'][A-Za-zА-Яа-яЁё]+)*/g) ?? []
  return normalize ? words.map(normalizeWord) : words
}

function normalizeWord(word: string) {
  return word.trim().toLowerCase().replace(/ё/g, 'е')
}

function normalizeTerms(items: string[]) {
  return Array.from(
    new Set(
      items
        .flatMap((item) => item.split(/[\n,;]+/))
        .map((item) => item.trim().toLowerCase().replace(/ё/g, 'е'))
        .filter(Boolean),
    ),
  )
}

function countItems(items: string[]) {
  return items.reduce((counter, item) => {
    counter.set(item, (counter.get(item) ?? 0) + 1)
    return counter
  }, new Map<string, number>())
}

function countNgrams(words: string[], sizes: number[]) {
  const counter = new Map<string, number>()

  sizes.forEach((size) => {
    for (let index = 0; index <= words.length - size; index += 1) {
      const phrase = words.slice(index, index + size).join(' ')
      const key = `${size}:${phrase}`
      counter.set(key, (counter.get(key) ?? 0) + 1)
    }
  })

  return counter
}

function countWater(words: string[], text: string) {
  const counter = new Map<string, number>()

  words.forEach((word) => {
    if (defaultStopWords.has(word) || waterMarkers.has(word)) {
      counter.set(word, (counter.get(word) ?? 0) + 1)
    }
  })

  const normalizedText = normalizeWord(text)
  waterMarkers.forEach((marker) => {
    if (!marker.includes(' ')) {
      return
    }

    const count = normalizedText.split(marker).length - 1
    if (count > 0) {
      counter.set(marker, (counter.get(marker) ?? 0) + count)
    }
  })

  return counter
}

function buildStructure(text: string): SeoStructure {
  const wordsCount = tokenize(text).length

  if (wordsCount === 0) {
    return {
      paragraphs_count: 0,
      sentences_count: 0,
      words_count: 0,
      avg_words_per_paragraph: 0,
      avg_words_per_sentence: 0,
      paragraphs: [],
    }
  }

  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const safeParagraphs = paragraphs.length ? paragraphs : [text.trim()]
  const sentences = splitSentences(text)
  const sentencesCount = sentences.length || 1

  return {
    paragraphs_count: safeParagraphs.length,
    sentences_count: sentencesCount,
    words_count: wordsCount,
    avg_words_per_paragraph: round(wordsCount / safeParagraphs.length),
    avg_words_per_sentence: round(wordsCount / sentencesCount),
    paragraphs: safeParagraphs.map((paragraph, index) => {
      const paragraphWords = tokenize(paragraph).length
      const paragraphSentences = splitSentences(paragraph).length || (paragraphWords > 0 ? 1 : 0)

      return {
        index: index + 1,
        words_count: paragraphWords,
        sentences_count: paragraphSentences,
        percent_of_text: round(paragraphWords / wordsCount * 100),
        preview: paragraph.replace(/\s+/g, ' ').slice(0, 160),
      }
    }),
  }
}

function splitSentences(text: string) {
  return text
    .split(/[.!?;]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => tokenize(sentence).length > 0)
}

function hasMixedAlphabet(word: string) {
  return /[A-Za-z]/.test(word) && /[А-Яа-яЁё]/.test(word)
}

function suggestMixedWord(word: string) {
  return word
    .split('')
    .map((letter) => mixedMap[letter] ?? letter)
    .join('')
}

function getKeywordStatus(count: number, density: number, threshold: number) {
  if (count === 0) {
    return 'missing'
  }

  if (density >= threshold) {
    return 'spam'
  }

  if (density >= threshold * 0.7) {
    return 'high'
  }

  if (density < 0.3) {
    return 'low'
  }

  return 'normal'
}

function buildRecommendations(
  keywords: SeoKeywordRow[],
  spamWarnings: SeoSpamWarning[],
  waterPercent: number,
  mixedCount: number,
) {
  const recommendations = [
    ...keywords
      .filter((keyword) => keyword.status === 'missing')
      .map((keyword) => `Добавьте ключ «${keyword.keyword}» в текст или заголовки.`),
    ...keywords
      .filter((keyword) => keyword.status === 'high' || keyword.status === 'spam')
      .map((keyword) => `Снизьте плотность ключа «${keyword.keyword}»: сейчас ${keyword.density}%.`),
    ...spamWarnings
      .slice(0, 3)
      .map((warning) => `Единица «${warning.item}» превышает порог переспама.`),
  ]

  if (waterPercent > 45) {
    recommendations.push('Снизьте водность: уберите вводные обороты и слабые служебные слова.')
  }

  if (mixedCount > 0) {
    recommendations.push('Проверьте слова со смешанной кириллицей и латиницей.')
  }

  return recommendations.length
    ? recommendations
    : ['Критичных проблем не найдено. Проверьте структуру текста перед публикацией.']
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function hashText(value: string) {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function wait() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, MOCK_DELAY)
  })
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}
