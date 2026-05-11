export type KeywordStatus = 'missing' | 'low' | 'normal' | 'high' | 'spam' | string

export interface SeoWordRow {
  word: string
  count: number
  density: number
  length: number
  is_keyword: boolean
}

export interface SeoNgramRow {
  phrase: string
  size: number
  count: number
  density: number
  is_keyword: boolean
}

export interface SeoKeywordRow {
  keyword: string
  type: 'word' | 'ngram'
  count: number
  density: number
  status: KeywordStatus
}

export interface SeoSpamWarning {
  item: string
  type: 'word' | 'ngram' | string
  count: number
  density: number
  threshold: number
  status: string
}

export interface SeoWaterMarker {
  marker: string
  count: number
}

export interface SeoWater {
  percent: number
  level: 'low' | 'medium' | 'high' | string
  water_units_count: number
  total_words: number
  markers?: SeoWaterMarker[]
  top_markers: SeoWaterMarker[]
}

export interface SeoMixedAlphabetWord {
  word: string
  count: number
  suggestion: string
}

export interface SeoStructureParagraph {
  index: number
  words_count: number
  sentences_count: number
  percent_of_text: number
  preview: string
}

export interface SeoStructure {
  paragraphs_count: number
  sentences_count: number
  words_count: number
  avg_words_per_paragraph: number
  avg_words_per_sentence: number
  paragraphs: SeoStructureParagraph[]
}

export interface SeoSummary {
  documents_count: number
  total_words: number
  unique_words: number
  keywords_total: number
  keywords_found: number
  keywords_missing: number
  spam_warnings_count: number
  water_percent: number
  mixed_alphabet_count: number
  spam_level: string
  keyword_coverage_percent: number
}

export interface SeoResult {
  summary: SeoSummary
  words: SeoWordRow[]
  ngrams: SeoNgramRow[]
  keywords: SeoKeywordRow[]
  spam_warnings: SeoSpamWarning[]
  water: SeoWater
  mixed_alphabet_words: SeoMixedAlphabetWord[]
  structure?: SeoStructure
  recommendations: string[]
  lexicon?: {
    stop_words: string[]
    water_markers: string[]
  }
  charts?: {
    top_words?: Array<{ label: string; value: number }>
    top_ngrams?: Array<{ label: string; value: number }>
    keyword_coverage?: { found: number; total: number }
    water?: { percent: number; level: string }
    spam?: { count: number; level: string }
    structure?: {
      paragraph_share?: Array<{ label: string; value: number }>
      paragraph_words?: Array<{ label: string; value: number }>
      sentence_words?: Array<{ label: string; value: number }>
    }
  }
}

export interface LastAnalysisResult<T> {
  analysis_type: string
  selected_document_ids: string[]
  params_snapshot: unknown
  result: T
  is_actual: boolean
  invalidation_reason?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type SeoTableExportType = 'words' | 'ngrams' | 'keywords' | 'spam' | 'water' | 'mixed'
