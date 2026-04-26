import { useRef, useState } from 'react'
import { downloadCsv, runAnalysis, saveCorpus } from '../api/client'
import { APP_MESSAGES } from '../constants/messages'
import type { AnalysisParams, AnalysisResponse, UiDocument } from '../types'
import { toPositiveInteger } from '../utils/analysisParams'
import { getDocumentDisplayName, toCsvFileName } from '../utils/documents'

type UseAnalyzerActionsParams = {
  analysisParams: AnalysisParams
  browserId: string
  documents: UiDocument[]
  onExportError: (message: string) => void
  onSaveError: (message: string) => void
  onSaveSuccess: (message: string) => void
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
  onSaveSuccess,
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
        documents: documents.map((document) => ({
          id: document.id,
          content: document.content,
        })),
      })

      if (saveRequestId === saveRequestIdRef.current) {
        setIsCorpusSaved(true)
        setHasUnsavedChanges(false)
        setHasSuccessfulAnalysis(false)
        onSaveSuccess(APP_MESSAGES.saveSuccess)
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
        params: {
          top_n: toPositiveInteger(analysisParams.topN, 20),
          min_word_length: toPositiveInteger(analysisParams.minWordLength, 3),
          order_by: analysisParams.orderBy,
        },
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

  async function handleExport(identifiers: string[]) {
    try {
      for (const identifier of identifiers) {
        const preferredFileName =
          identifier === 'corpus'
            ? 'statistics.csv'
            : toCsvFileName(
                getDocumentDisplayName(
                  documents.find((document) => String(document.id) === identifier) ?? {
                    id: Number(identifier),
                    title: '',
                    content: '',
                  },
                  0,
                ),
              )

        await downloadCsv(identifier, preferredFileName)
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
    markCorpusAsChanged,
    resetAnalysisState,
  }
}
