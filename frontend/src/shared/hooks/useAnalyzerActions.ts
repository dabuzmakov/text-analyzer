import { useState } from 'react'
import { downloadCsv, runAnalysis, saveCorpus } from '../api/client'
import { APP_MESSAGES } from '../constants/messages'
import type { AnalysisParams, AnalysisResponse, UiDocument } from '../types'
import { getDocumentDisplayName, toCsvFileName } from '../utils/documents'

type UseAnalyzerActionsParams = {
  analysisParams: AnalysisParams
  browserId: string
  documents: UiDocument[]
  onExportError: (message: string) => void
  onSaveError: (message: string) => void
  onSaveSuccess: (message: string) => void
}

function normalizeNumberInput(value: string, fallback: number) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return fallback
  }

  const parsedValue = Number(trimmedValue)

  if (Number.isNaN(parsedValue) || parsedValue < 1) {
    return fallback
  }

  return Math.floor(parsedValue)
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

      setIsCorpusSaved(true)
      setHasUnsavedChanges(false)
      setHasSuccessfulAnalysis(false)
      onSaveSuccess(APP_MESSAGES.saveSuccess)
    } catch (error) {
      const message = getErrorMessage(error)
      onSaveError(message)
      setIsCorpusSaved(false)
      setHasUnsavedChanges(true)
      setHasSuccessfulAnalysis(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAnalyze() {
    setIsAnalyzing(true)
    setAnalysisError('')

    try {
      const result = await runAnalysis({
        browser_id: browserId,
        params: {
          top_n: normalizeNumberInput(analysisParams.topN, 20),
          min_word_length: normalizeNumberInput(analysisParams.minWordLength, 3),
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
