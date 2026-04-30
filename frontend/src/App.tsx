import { FormEvent, useEffect, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { Main } from './components/Main'
import { ManualDocumentModal } from './components/ManualDocumentModal'
import { Toast } from './components/Toast'
import appStyles from './App.module.css'
import { APP_MESSAGES } from './shared/constants/messages'
import { useAnalyzerActions } from './shared/hooks/useAnalyzerActions'
import type {
  AnalysisParams,
  ManualForm,
} from './shared/types'
import type { UiDocument } from './shared/types'
import { getOrCreateBrowserId } from './shared/utils/browser'
import { sanitizePositiveIntegerInput } from './shared/utils/analysisParams'
import { createUiDocument } from './shared/utils/documents'
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

function normalizeAnalysisParams(
  candidate: Partial<AnalysisParams> | null | undefined,
): AnalysisParams {
  return {
    topN: sanitizePositiveIntegerInput(candidate?.topN, defaultParams.topN),
    minWordLength: sanitizePositiveIntegerInput(
      candidate?.minWordLength,
      defaultParams.minWordLength,
    ),
    orderBy:
      candidate?.orderBy === 'asc' || candidate?.orderBy === 'desc'
        ? candidate.orderBy
        : defaultParams.orderBy,
  }
}

function loadStoredParams() {
  const storedParams = localStorage.getItem(ANALYSIS_PARAMS_STORAGE_KEY)

  if (!storedParams) {
    return defaultParams
  }

  try {
    return normalizeAnalysisParams(JSON.parse(storedParams) as Partial<AnalysisParams>)
  } catch {
    return defaultParams
  }
}

export default function App() {
  const [browserId] = useState(getOrCreateBrowserId)
  const [documents, setDocuments] = useState<UiDocument[]>([])
  const [analysisParams, setAnalysisParams] = useState(loadStoredParams)
  const [manualForm, setManualForm] = useState(emptyManualForm)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [editingDocumentId, setEditingDocumentId] = useState<number | null>(null)
  const [nextDocumentId, setNextDocumentId] = useState(1)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [isToastVisible, setIsToastVisible] = useState(false)
  const didMountDocumentsRef = useRef(false)

  const {
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
  } = useAnalyzerActions({
    analysisParams,
    browserId,
    documents,
    onExportError: (message) => showToast(message, 'error'),
    onSaveError: (message) => showToast(message, 'error'),
  })

  useEffect(() => {
    localStorage.setItem(ANALYSIS_PARAMS_STORAGE_KEY, JSON.stringify(analysisParams))
  }, [analysisParams])

  useEffect(() => {
    if (!didMountDocumentsRef.current) {
      didMountDocumentsRef.current = true
      return
    }

    const saveTimer = window.setTimeout(() => {
      void handleSaveCorpus()
    }, 250)

    return () => {
      window.clearTimeout(saveTimer)
    }
  }, [documents])

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
  const canAnalyze =
    documents.length > 0 &&
    isCorpusSaved &&
    !hasUnsavedChanges &&
    !isSaving &&
    !isAnalyzing
  const canExport =
    hasSuccessfulAnalysis &&
    analysisResult !== null &&
    isCorpusSaved &&
    !hasUnsavedChanges &&
    documents.length > 0

  function showToast(message: string, type: ToastState['type']) {
    setToast({
      id: Date.now(),
      type,
      message,
    })
  }

  function updateDocuments(nextDocuments: UiDocument[]) {
    setDocuments(nextDocuments)
    resetAnalysisState()
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
    setAnalysisParams((current) => {
      if (field === 'topN' || field === 'minWordLength') {
        return {
          ...current,
          [field]: sanitizePositiveIntegerInput(value, current[field]),
        }
      }

      return {
        ...current,
        orderBy: value as AnalysisParams['orderBy'],
      }
    })
  }

  async function handleFilesAdded(files: File[]) {
    if (files.length === 0) {
      return
    }

    const freeSlots = MAX_DOCUMENTS - documents.length
    const selectedFiles = files.slice(0, freeSlots)
    const startingDocumentId = nextDocumentId

    setNextDocumentId((current) => current + selectedFiles.length)

    try {
      const newDocuments = await Promise.all(
        selectedFiles.map(async (file, index) => {
          const content = await readTextFile(file)

          return createUiDocument(
            startingDocumentId + index,
            file.name.replace(/\.txt$/i, '') || file.name,
            content,
          )
        }),
      )

      updateDocuments([...documents, ...newDocuments])
    } catch (error) {
      showToast(APP_MESSAGES.unexpectedError, 'error')
    }
  }

  function handleRemoveDocument(documentId: number) {
    updateDocuments(documents.filter((document) => document.id !== documentId))
  }

  function handleEditDocument(documentId: number) {
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
      const documentId = nextDocumentId
      setNextDocumentId((current) => current + 1)
      updateDocuments([...documents, createUiDocument(documentId, title, content)])
    }

    closeManualModal()
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

        <Main
          analysisError={analysisError}
          analysisParams={analysisParams}
          analysisResult={analysisResult}
          canAnalyze={canAnalyze}
          canExport={canExport}
          canUpload={!isDocumentLimitReached}
          documents={documents}
          isAnalyzing={isAnalyzing}
          maxDocuments={MAX_DOCUMENTS}
          onAddManual={openCreateModal}
          onAnalyze={handleAnalyze}
          onChangeAnalysisParam={updateAnalysisParam}
          onEditDocument={handleEditDocument}
          onExport={handleExport}
          onFilesAdded={handleFilesAdded}
          onRemoveDocument={handleRemoveDocument}
        />
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
