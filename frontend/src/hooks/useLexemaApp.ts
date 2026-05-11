import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { getAppState } from '../api/appApi'
import { runSeoAnalysis } from '../api/analysisApi'
import {
  createDocument,
  deleteDocument,
  updateDocument,
} from '../api/documentsApi'
import { downloadSeoCsv, downloadSeoZip } from '../api/exportApi'
import { saveSettings } from '../api/settingsApi'
import {
  DEFAULT_DISPLAY_SETTINGS,
  DISPLAY_SETTINGS_STORAGE_KEY,
  MAX_DOCUMENTS,
} from '../shared/constants/lexema'
import {
  createMarkdownTable,
  getOrCreateBrowserId,
  getStoredDisplaySettings,
  markSeoStale,
  normalizeAnalysisSettings,
  normalizeDisplaySettings,
  readTextFile,
  sanitizeDocumentTitle,
  splitTextarea,
} from '../shared/utils/lexema'
import type {
  LastAnalysisResult,
  SeoKeywordRow,
  SeoNgramRow,
  SeoResult,
  SeoTableExportType,
  SeoWordRow,
} from '../types/analysis'
import type { DocumentItem } from '../types/documents'
import {
  DEFAULT_ANALYSIS_SETTINGS,
  type AnalysisSettings,
  type StopWordsMode,
} from '../types/settings'
import type { DisplaySettings, DocumentModalState, TabId, WordSort } from '../types/ui'

type AppMessage = {
  text: string
  variant?: 'copy' | 'info'
}

export function useLexemaApp() {
  const [browserId] = useState(getOrCreateBrowserId)
  const [activeTab, setActiveTab] = useState<TabId>('seo')
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_ANALYSIS_SETTINGS)
  const [settingsDraft, setSettingsDraft] =
    useState<AnalysisSettings>(DEFAULT_ANALYSIS_SETTINGS)
  const [seoResult, setSeoResult] = useState<LastAnalysisResult<SeoResult> | null>(null)
  const [selectedSeoDocumentIds, setSelectedSeoDocumentIds] = useState<string[]>([])
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [documentSearch, setDocumentSearch] = useState('')
  const [modal, setModal] = useState<DocumentModalState | null>(null)
  const [isAppLoading, setIsAppLoading] = useState(true)
  const [isDocumentSaving, setIsDocumentSaving] = useState(false)
  const [isSettingsSaving, setIsSettingsSaving] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState<AppMessage | null>(null)
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(getStoredDisplaySettings)
  const [displaySettingsDraft, setDisplaySettingsDraft] =
    useState<DisplaySettings>(getStoredDisplaySettings)
  const [wordTopN, setWordTopN] = useState(displaySettings.topN)
  const [wordMinLength, setWordMinLength] = useState(displaySettings.minLength)
  const [wordSort, setWordSort] = useState<WordSort>(displaySettings.sort)
  const [ngramSizes, setNgramSizes] = useState<number[]>([2, 3])
  const [ngramTopN, setNgramTopN] = useState(20)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let isMounted = true

    getAppState(browserId)
      .then((state) => {
        if (!isMounted) {
          return
        }

        setDocuments(state.documents)
        const normalizedSettings = normalizeAnalysisSettings(state.settings, { migrateLegacyDefault: true })
        setSettings(normalizedSettings)
        setSettingsDraft(normalizedSettings)
        setSeoResult(state.last_results.seo)

        const restoredSelection = state.last_results.seo?.selected_document_ids ?? []
        setSelectedSeoDocumentIds(
          restoredSelection.length > 0
            ? restoredSelection
            : state.documents.map((document) => document.id),
        )
      })
      .catch((error: Error) => showMessage(error.message))
      .finally(() => {
        if (isMounted) {
          setIsAppLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [browserId])

  const filteredDocuments = useMemo(() => {
    const query = documentSearch.trim().toLowerCase()

    if (!query) {
      return documents
    }

    return documents.filter((document) =>
      `${document.title} ${document.content}`.toLowerCase().includes(query),
    )
  }, [documentSearch, documents])

  const selectedSeoDocuments = useMemo(
    () => documents.filter((document) => selectedSeoDocumentIds.includes(document.id)),
    [documents, selectedSeoDocumentIds],
  )

  const filteredWords = useMemo(() => {
    const rows = seoResult?.result.words ?? []
    const sortedRows = rows
      .filter((row) => row.length >= wordMinLength)
      .sort((left, right) => {
        if (wordSort === 'count_asc') {
          return left.count - right.count
        }
        if (wordSort === 'alpha') {
          return left.word.localeCompare(right.word, 'ru')
        }
        return right.count - left.count
      })

    return sortedRows.slice(0, wordTopN)
  }, [seoResult, wordMinLength, wordSort, wordTopN])

  const filteredNgrams = useMemo(() => {
    const rows = seoResult?.result.ngrams ?? []

    return rows
      .filter((row) => ngramSizes.includes(row.size))
      .sort((left, right) => right.count - left.count)
      .slice(0, ngramTopN)
  }, [ngramSizes, ngramTopN, seoResult])

  const corpusSummary = useMemo(
    () => ({
      words: documents.reduce((sum, document) => sum + document.raw_word_count, 0),
      chars: documents.reduce((sum, document) => sum + document.char_count, 0),
    }),
    [documents],
  )

  const canUpload = documents.length < MAX_DOCUMENTS && !isDocumentSaving

  function showMessage(nextMessage: string, variant: AppMessage['variant'] = 'info') {
    setMessage({ text: nextMessage, variant })
    window.setTimeout(() => setMessage(null), 2600)
  }

  function openFilePicker() {
    if (canUpload) {
      fileInputRef.current?.click()
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files).filter((file) => file.name.endsWith('.txt'))

    if (selectedFiles.length === 0) {
      showMessage('Выберите файл в формате .txt')
      return
    }

    const freeSlots = MAX_DOCUMENTS - documents.length
    const filesToUpload = selectedFiles.slice(0, freeSlots)

    if (filesToUpload.length === 0) {
      showMessage('Лимит документов уже достигнут')
      return
    }

    setIsDocumentSaving(true)
    try {
      const createdDocuments: DocumentItem[] = []

      for (const file of filesToUpload) {
        const content = (await readTextFile(file)).trim()

        if (!content) {
          continue
        }

        const created = await createDocument(browserId, {
          title: sanitizeDocumentTitle(file.name),
          content,
        })
        createdDocuments.push(created)
      }

      if (createdDocuments.length > 0) {
        setDocuments((current) => [...createdDocuments, ...current])
        setSelectedSeoDocumentIds((current) => [
          ...createdDocuments.map((document) => document.id),
          ...current,
        ])
        setSeoResult((current) => markSeoStale(current, 'Документы изменены'))
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось загрузить документ')
    } finally {
      setIsDocumentSaving(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      void handleFiles(event.target.files)
    }
  }

  function openCreateDocumentModal() {
    setModal({
      mode: 'create',
      title: '',
      content: '',
    })
  }

  function openEditDocumentModal(document: DocumentItem) {
    setModal({
      mode: 'edit',
      documentId: document.id,
      title: document.title,
      content: document.content,
    })
  }

  async function handleDocumentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!modal) {
      return
    }

    const title = modal.title.trim()
    const content = modal.content.trim()

    if (!title || !content) {
      showMessage('Заполните название и текст документа')
      return
    }

    setIsDocumentSaving(true)
    try {
      if (modal.mode === 'edit' && modal.documentId) {
        const updated = await updateDocument(browserId, modal.documentId, {
          title,
          content,
        })
        setDocuments((current) =>
          current.map((document) => (document.id === updated.id ? updated : document)),
        )
      } else {
        const created = await createDocument(browserId, { title, content })
        setDocuments((current) => [created, ...current])
        setSelectedSeoDocumentIds((current) => [created.id, ...current])
      }

      setSeoResult((current) => markSeoStale(current, 'Документы изменены'))
      setModal(null)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось сохранить документ')
    } finally {
      setIsDocumentSaving(false)
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setIsDocumentSaving(true)
    try {
      await deleteDocument(browserId, documentId)
      setDocuments((current) => current.filter((document) => document.id !== documentId))
      setSelectedDocumentIds((current) => current.filter((id) => id !== documentId))
      setSelectedSeoDocumentIds((current) => current.filter((id) => id !== documentId))
      setSeoResult((current) => markSeoStale(current, 'Документы изменены'))
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось удалить документ')
    } finally {
      setIsDocumentSaving(false)
    }
  }

  async function handleDeleteSelectedDocuments() {
    if (selectedDocumentIds.length === 0) {
      return
    }

    setIsDocumentSaving(true)
    try {
      await Promise.all(selectedDocumentIds.map((id) => deleteDocument(browserId, id)))
      setDocuments((current) =>
        current.filter((document) => !selectedDocumentIds.includes(document.id)),
      )
      setSelectedSeoDocumentIds((current) =>
        current.filter((id) => !selectedDocumentIds.includes(id)),
      )
      setSelectedDocumentIds([])
      setSeoResult((current) => markSeoStale(current, 'Документы изменены'))
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось удалить документы')
    } finally {
      setIsDocumentSaving(false)
    }
  }

  function toggleDocumentSelection(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    )
  }

  function toggleSeoDocument(documentId: string) {
    setSelectedSeoDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    )
  }

  function updateSettingsDraft(nextSettings: Partial<AnalysisSettings>) {
    setSettingsDraft((current) => ({
      ...current,
      ...nextSettings,
    }))
  }

  function setStopWordsMode(mode: StopWordsMode) {
    updateSettingsDraft({
      stop_words: {
        ...settingsDraft.stop_words,
        mode,
      },
    })
  }

  function toggleNgramSize(size: number) {
    const nextSizes = settingsDraft.ngrams.sizes.includes(size)
      ? settingsDraft.ngrams.sizes.filter((item) => item !== size)
      : [...settingsDraft.ngrams.sizes, size]

    updateSettingsDraft({
      ngrams: {
        sizes: nextSizes.sort(),
      },
    })
  }

  async function handleSaveSettings() {
    setIsSettingsSaving(true)
    try {
      const nextSettings = normalizeAnalysisSettings(settingsDraft)
      const analysisSettingsChanged = JSON.stringify(nextSettings) !== JSON.stringify(settings)
      const nextDisplaySettings = normalizeDisplaySettings(displaySettingsDraft)
      const saved = normalizeAnalysisSettings(await saveSettings(browserId, nextSettings))
      setSettings(saved)
      setSettingsDraft(saved)
      setDisplaySettings(nextDisplaySettings)
      setDisplaySettingsDraft(nextDisplaySettings)
      setWordTopN(nextDisplaySettings.topN)
      setWordMinLength(nextDisplaySettings.minLength)
      setWordSort(nextDisplaySettings.sort)
      window.localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(nextDisplaySettings))

      if (analysisSettingsChanged) {
        setSeoResult((current) => markSeoStale(current, 'Параметры анализа изменены'))
      }

      showMessage('Параметры сохранены')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось сохранить параметры')
    } finally {
      setIsSettingsSaving(false)
    }
  }

  function resetSettingsDraft() {
    setSettingsDraft(DEFAULT_ANALYSIS_SETTINGS)
    setDisplaySettingsDraft(DEFAULT_DISPLAY_SETTINGS)
  }

  async function handleRunSeoAnalysis() {
    if (selectedSeoDocumentIds.length === 0) {
      showMessage('Выберите хотя бы один документ')
      return
    }

    setIsAnalyzing(true)
    try {
      const result = await runSeoAnalysis(browserId, selectedSeoDocumentIds, settings)
      setSeoResult(result)
      setSelectedSeoDocumentIds(result.selected_document_ids)
      showMessage('SEO-Анализ выполнен')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось выполнить анализ')
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function handleCsvExport(type: SeoTableExportType) {
    setIsExporting(true)
    try {
      await downloadSeoCsv(type, browserId)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось экспортировать CSV')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleZipExport() {
    setIsExporting(true)
    try {
      await downloadSeoZip(browserId)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось экспортировать ZIP')
    } finally {
      setIsExporting(false)
    }
  }

  async function copyMarkdown(markdown: string) {
    try {
      await navigator.clipboard.writeText(markdown)
      showMessage('Markdown скопирован', 'copy')
    } catch {
      showMessage('Не удалось скопировать Markdown')
    }
  }

  function copyWordsMarkdown(rows: SeoWordRow[]) {
    void copyMarkdown(
      createMarkdownTable(
        ['Слово', 'Частота', 'Плотность'],
        rows.map((row) => [row.word, row.count, `${row.density}%`]),
      ),
    )
  }

  function copyNgramsMarkdown(rows: SeoNgramRow[]) {
    void copyMarkdown(
      createMarkdownTable(
        ['Фраза', 'Размер', 'Частота', 'Плотность'],
        rows.map((row) => [row.phrase, row.size, row.count, `${row.density}%`]),
      ),
    )
  }

  function copyKeywordsMarkdown(rows: SeoKeywordRow[]) {
    void copyMarkdown(
      createMarkdownTable(
        ['Ключ', 'Найдено', 'Частота', 'Плотность', 'Статус'],
        rows.map((row) => [
          row.keyword,
          row.count > 0 ? 'Да' : 'Нет',
          row.count,
          `${row.density}%`,
          row.status,
        ]),
      ),
    )
  }

  return {
    activeTab,
    canUpload,
    corpusSummary,
    documentSearch,
    documents,
    fileInputRef,
    filteredDocuments,
    filteredNgrams,
    filteredWords,
    handleCsvExport,
    handleDeleteDocument,
    handleDeleteSelectedDocuments,
    handleDocumentSubmit,
    handleFileInput,
    handleFiles,
    handleRunSeoAnalysis,
    handleSaveSettings,
    handleZipExport,
    isAnalyzing,
    isAppLoading,
    isDocumentSaving,
    isExporting,
    isSettingsSaving,
    message,
    modal,
    ngramSizes,
    ngramTopN,
    openCreateDocumentModal,
    openEditDocumentModal,
    openFilePicker,
    resetSettingsDraft,
    selectedDocumentIds,
    selectedSeoDocumentIds,
    selectedSeoDocuments,
    seoResult,
    setActiveTab,
    setDocumentSearch,
    setModal,
    setNgramSizes,
    setNgramTopN,
    setSelectedDocumentIds,
    setSelectedSeoDocumentIds,
    setStopWordsMode,
    setWordMinLength,
    setWordSort,
    setWordTopN,
    settings,
    settingsDraft,
    toggleDocumentSelection,
    toggleNgramSize,
    toggleSeoDocument,
    updateSettingsDraft,
    wordMinLength,
    wordSort,
    wordTopN,
    copyKeywordsMarkdown,
    copyNgramsMarkdown,
    copyWordsMarkdown,
  }
}
