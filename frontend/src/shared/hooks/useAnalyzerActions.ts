import { useRef, useState } from 'react'
import { downloadCsv, runAnalysis, saveCorpus } from '../api/client'
import { APP_MESSAGES } from '../constants/messages'
import type {
  AnalysisApiParams,
  AnalysisParams,
  AnalysisResponse,
  ExportIdentifier,
  UiDocument,
} from '../types'
import { toPositiveInteger } from '../utils/analysisParams'
import { getDocumentDisplayName, toCsvFileName } from '../utils/documents'

type UseAnalyzerActionsParams = {
  analysisParams: AnalysisParams
  browserId: string
  documents: UiDocument[]
  onExportError: (message: string) => void
  onSaveError: (message: string) => void
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return APP_MESSAGES.unexpectedError
}

export function useAnalyzerActions({
  analysisParams,
  browserId,
  documents,
  onExportError,
  onSaveError,
}: UseAnalyzerActionsParams) {
  const [analysisError, setAnalysisError] = useState('')
  const [analysisResult, setAnalysisResult] =
    useState<AnalysisResponse['data'] | null>(null)
  const [hasSuccessfulAnalysis, setHasSuccessfulAnalysis] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCorpusSaved, setIsCorpusSaved] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const saveRequestIdRef = useRef(0)

  function getAnalysisApiParams(): AnalysisApiParams {
    return {
      top_n: toPositiveInteger(analysisParams.topN, 20),
      min_word_length: toPositiveInteger(analysisParams.minWordLength, 3),
      order_by: analysisParams.orderBy,
    }
  }

  function getCorpusPayload() {
    return documents.map((document) => ({
      id: document.id,
      content: document.content,
    }))
  }

  function getPreferredExportFileName(identifier: ExportIdentifier) {
    if (identifier === 'corpus') {
      return 'statistics.csv'
    }

    const document = documents.find((item) => String(item.id) === identifier)
    const fallbackDocument = {
      id: Number(identifier),
      title: '',
      content: '',
    }

    return toCsvFileName(
      getDocumentDisplayName(document ?? fallbackDocument, 0),
    )
  }

  function markCorpusAsChanged() {
    setIsCorpusSaved(false)
    setHasUnsavedChanges(true)
    setHasSuccessfulAnalysis(false)
    setAnalysisError('')
  }

  function resetAnalysisState() {
    setAnalysisResult(null)
    markCorpusAsChanged()
  }

  async function handleSaveCorpus() {
    const saveRequestId = saveRequestIdRef.current + 1
    saveRequestIdRef.current = saveRequestId

    setIsSaving(true)
    setAnalysisError('')

    try {
      await saveCorpus({
        browser_id: browserId,
        documents: getCorpusPayload(),
      })

      if (saveRequestId === saveRequestIdRef.current) {
        setIsCorpusSaved(true)
        setHasUnsavedChanges(false)
        setHasSuccessfulAnalysis(false)
      }
    } catch (error) {
      const message = getErrorMessage(error)
      if (saveRequestId === saveRequestIdRef.current) {
        onSaveError(message)
        setIsCorpusSaved(false)
        setHasUnsavedChanges(true)
        setHasSuccessfulAnalysis(false)
      }
    } finally {
      if (saveRequestId === saveRequestIdRef.current) {
        setIsSaving(false)
      }
    }
  }

  async function handleAnalyze() {
    setIsAnalyzing(true)
    setAnalysisError('')

    try {
      const result = await runAnalysis({
        browser_id: browserId,
        params: getAnalysisApiParams(),
      })

      setAnalysisResult(result.data)
      setHasSuccessfulAnalysis(true)
    } catch (error) {
      setAnalysisResult(null)
      setHasSuccessfulAnalysis(false)
      setAnalysisError(getErrorMessage(error))
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function handleExport(identifiers: ExportIdentifier[]) {
    try {
      const exportParams = {
        browser_id: browserId,
        ...getAnalysisApiParams(),
      }

      for (const identifier of identifiers) {
        await downloadCsv(
          identifier,
          getPreferredExportFileName(identifier),
          exportParams,
        )
      }
    } catch {
      onExportError(APP_MESSAGES.downloadCsvError)
      throw new Error(APP_MESSAGES.downloadCsvError)
    }
  }

  return {
    analysisError,
    analysisResult,
    handleAnalyze,
    handleExport,
    handleSaveCorpus,
    hasSuccessfulAnalysis,
    hasUnsavedChanges,
    isAnalyzing,
    isCorpusSaved,
    isSaving,
    resetAnalysisState,
  }
}
