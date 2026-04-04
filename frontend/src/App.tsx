import { FormEvent, useEffect, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { CorpusPanel } from './components/CorpusPanel'
import { FiltersPanel } from './components/FiltersPanel'
import { ManualDocumentModal } from './components/ManualDocumentModal'
import { ResultPanel } from './components/ResultPanel'
import { Toast } from './components/Toast'
import appStyles from './App.module.css'
import { runAnalysis, saveCorpus } from './shared/api/client'
import { APP_MESSAGES } from './shared/constants/messages'
import type {
  AnalysisParams,
  AnalysisResult,
  DocumentItem,
  ManualForm,
} from './shared/types'
import { getOrCreateBrowserId } from './shared/utils/browser'
import { readTextFile } from './shared/utils/files'

const MAX_DOCUMENTS = 30
const ANALYSIS_PARAMS_STORAGE_KEY = 'text-analyzer-analysis-params'

const defaultParams: AnalysisParams = {
  topN: '20',
  minWordLength: '3',
  orderBy: 'desc',
}

const emptyManualForm: ManualForm = {
  title: '',
  content: '',
}

const TOAST_DURATION = 1000
const TOAST_EXIT_DURATION = 220

type ToastState = {
  id: number
  type: 'success' | 'error'
  message: string
}

function loadStoredParams() {
  const storedParams = localStorage.getItem(ANALYSIS_PARAMS_STORAGE_KEY)

  if (!storedParams) {
    return defaultParams
  }

  try {
    return { ...defaultParams, ...JSON.parse(storedParams) }
  } catch {
    return defaultParams
  }
}

function createDocumentId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createDocument(title: string, content: string): DocumentItem {
  return {
    id: createDocumentId(),
    title,
    content,
  }
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

export default function App() {
  const [browserId] = useState(getOrCreateBrowserId)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [analysisParams, setAnalysisParams] = useState(loadStoredParams)
  const [manualForm, setManualForm] = useState(emptyManualForm)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCorpusSaved, setIsCorpusSaved] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [isToastVisible, setIsToastVisible] = useState(false)

  useEffect(() => {
    localStorage.setItem(ANALYSIS_PARAMS_STORAGE_KEY, JSON.stringify(analysisParams))
  }, [analysisParams])

  useEffect(() => {
    let hideTimer = 0
    let removeTimer = 0

    if (toast) {
      setIsToastVisible(true)
      hideTimer = window.setTimeout(() => {
        setIsToastVisible(false)
      }, TOAST_DURATION)
      removeTimer = window.setTimeout(() => {
        setToast(null)
      }, TOAST_DURATION + TOAST_EXIT_DURATION)
    }

    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(removeTimer)
    }
  }, [toast])

  const isDocumentLimitReached = documents.length >= MAX_DOCUMENTS
  const isEditingDocument = editingDocumentId !== null
  const canSave = documents.length > 0 && !isSaving
  const canAnalyze =
    documents.length > 0 &&
    isCorpusSaved &&
    !hasUnsavedChanges &&
    !isSaving &&
    !isAnalyzing

  function showToast(message: string, type: ToastState['type']) {
    setToast({
      id: Date.now(),
      type,
      message,
    })
  }

  function markCorpusAsChanged() {
    setIsCorpusSaved(false)
    setHasUnsavedChanges(true)
    setAnalysisError('')
  }

  function updateDocuments(nextDocuments: DocumentItem[]) {
    setDocuments(nextDocuments)
    setAnalysisResult(null)
    markCorpusAsChanged()
  }

  function resetManualForm() {
    setManualForm(emptyManualForm)
  }

  function closeManualModal() {
    setIsManualModalOpen(false)
    setEditingDocumentId(null)
    resetManualForm()
  }

  function openCreateModal() {
    setEditingDocumentId(null)
    resetManualForm()
    setIsManualModalOpen(true)
  }

  function updateManualForm(field: keyof ManualForm, value: string) {
    setManualForm({
      ...manualForm,
      [field]: value,
    })
  }

  function updateAnalysisParam(field: keyof AnalysisParams, value: string) {
    setAnalysisParams({
      ...analysisParams,
      [field]: value,
    })
  }

  async function handleFilesAdded(files: File[]) {
    if (files.length === 0) {
      return
    }

    const freeSlots = MAX_DOCUMENTS - documents.length
    const selectedFiles = files.slice(0, freeSlots)

    try {
      const newDocuments = await Promise.all(
        selectedFiles.map(async (file) => {
          const content = await readTextFile(file)

          return createDocument(file.name.replace(/\.txt$/i, '') || file.name, content)
        }),
      )

      updateDocuments([...documents, ...newDocuments])
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
    }
  }

  function handleRemoveDocument(documentId: string) {
    updateDocuments(documents.filter((document) => document.id !== documentId))
  }

  function handleEditDocument(documentId: string) {
    const documentToEdit = documents.find((document) => document.id === documentId)

    if (!documentToEdit) {
      return
    }

    setManualForm({
      title: documentToEdit.title,
      content: documentToEdit.content,
    })
    setEditingDocumentId(documentId)
    setIsManualModalOpen(true)
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isDocumentLimitReached && !isEditingDocument) {
      return
    }

    const title = manualForm.title.trim()
    const content = manualForm.content.trim()

    if (!title || !content) {
      return
    }

    if (isEditingDocument) {
      updateDocuments(
        documents.map((document) =>
          document.id === editingDocumentId
            ? { ...document, title, content }
            : document,
        ),
      )
    } else {
      updateDocuments([...documents, createDocument(title, content)])
    }

    closeManualModal()
  }

  async function handleSaveCorpus() {
    setIsSaving(true)
    setAnalysisError('')

    try {
      await saveCorpus({
        browser_id: browserId,
        documents: documents.map((document) => ({
          title: document.title,
          content: document.content,
        })),
      })

      setIsCorpusSaved(true)
      setHasUnsavedChanges(false)
      showToast(APP_MESSAGES.saveSuccess, 'success')
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
      setIsCorpusSaved(false)
      setHasUnsavedChanges(true)
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

      setAnalysisResult(result)
    } catch (error) {
      setAnalysisResult(null)
      setAnalysisError(getErrorMessage(error))
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <>
      <div className={appStyles.app}>
        {toast ? (
          <Toast
            key={toast.id}
            isVisible={isToastVisible}
            message={toast.message}
            type={toast.type}
          />
        ) : null}

        <AppHeader />

        <main className={appStyles.workspace}>
          <div className={appStyles.grid}>
            <CorpusPanel
              canUpload={!isDocumentLimitReached}
              documents={documents}
              maxDocuments={MAX_DOCUMENTS}
              onAddManual={openCreateModal}
              onEditDocument={handleEditDocument}
              onFilesAdded={handleFilesAdded}
              onRemoveDocument={handleRemoveDocument}
            />

            <section className={appStyles.rightColumn}>
              <FiltersPanel
                analysisParams={analysisParams}
                onChange={updateAnalysisParam}
              />

              <ResultPanel
                analysisError={analysisError}
                analysisResult={analysisResult}
                canAnalyze={canAnalyze}
                isAnalyzing={isAnalyzing}
                isSaving={isSaving}
                onAnalyze={handleAnalyze}
                onSave={handleSaveCorpus}
                saveDisabled={!canSave}
              />
            </section>
          </div>
        </main>
      </div>

      <ManualDocumentModal
        form={manualForm}
        isEditing={isEditingDocument}
        isOpen={isManualModalOpen}
        onChange={updateManualForm}
        onClose={closeManualModal}
        onSubmit={handleManualSubmit}
      />
    </>
  )
}
