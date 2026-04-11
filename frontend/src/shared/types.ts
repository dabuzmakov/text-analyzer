export type UiDocument = {
  id: number
  title: string
  content: string
}

export type CorpusApiDocument = {
  id: number
  content: string
}

export type SaveCorpusRequest = {
  browser_id: string
  documents: CorpusApiDocument[]
}

export type SaveCorpusResponse = {
  status: 'success'
  message: string
}

export type AnalysisOrder = 'asc' | 'desc'

export type AnalysisParams = {
  topN: string
  minWordLength: string
  orderBy: AnalysisOrder
}

export type AnalysisApiParams = {
  top_n: number
  min_word_length: number
  order_by: AnalysisOrder
}

export type RunAnalysisRequest = {
  browser_id: string
  params: AnalysisApiParams
}

export type AnalysisSummary = {
  documents_count: number
  total_words: number
  unique_words: number
}

export type FrequencyRow = {
  word: string
  count: number
}

export type AnalysisResponse = {
  status: 'success'
  data: {
    summary: AnalysisSummary
    table: FrequencyRow[]
  }
}

export type ManualForm = {
  title: string
  content: string
}
