export type DocumentItem = {
  id: string
  title: string
  content: string
}

export type AnalysisParams = {
  topN: string
  minWordLength: string
  orderBy: AnalysisOrder
}

export type AnalysisOrder = 'asc' | 'desc'

export type AnalysisSummary = {
  documents_count: number
  total_words_before_filters: number
  total_words_after_filters: number
  unique_words: number
}

export type AnalysisRow = {
  word: string
  count: number
}

export type AnalysisResult = {
  applied_filters: {
    top_n: number
    min_word_length: number
    order_by: AnalysisOrder
  }
  summary: AnalysisSummary
  table: AnalysisRow[]
}

export type ManualForm = {
  title: string
  content: string
}
