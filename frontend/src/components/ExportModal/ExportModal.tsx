import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileSpreadsheet, Files, ListChecks } from 'lucide-react'
import type { UiDocument } from '../../shared/types'
import sharedButtonStyles from '../../shared/styles/buttonStyles.module.css'
import { getDocumentDisplayName } from '../../shared/utils/documents'
import styles from './ExportModal.module.css'

type ExportMode = 'corpus' | 'selected'

type ExportModalProps = {
  isOpen: boolean
  documents: UiDocument[]
  onClose: () => void
  onExport: (identifiers: string[]) => Promise<void>
}

export function ExportModal({
  isOpen,
  documents,
  onClose,
  onExport,
}: ExportModalProps) {
  const [exportMode, setExportMode] = useState<ExportMode>('corpus')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const documentListRef = useRef<HTMLDivElement | null>(null)
  const scrollbarTrackRef = useRef<HTMLDivElement | null>(null)
  const scrollbarThumbRef = useRef<HTMLDivElement | null>(null)
  const scrollAnimationFrameRef = useRef<number | null>(null)

  function syncCustomScrollbar() {
    const element = documentListRef.current
    const track = scrollbarTrackRef.current
    const thumb = scrollbarThumbRef.current

    if (!element || !track || !thumb) {
      return
    }

    const { clientHeight, scrollHeight, scrollTop } = element

    if (scrollHeight <= clientHeight) {
      track.dataset.visible = 'false'
      thumb.style.height = '0px'
      thumb.style.transform = 'translateY(0px)'
      return
    }

    const ratio = clientHeight / scrollHeight
    const thumbHeight = Math.max(clientHeight * ratio, 28)
    const maxOffset = clientHeight - thumbHeight
    const maxScroll = scrollHeight - clientHeight
    const thumbOffset = maxScroll > 0 ? (scrollTop / maxScroll) * maxOffset : 0

    track.dataset.visible = 'true'
    thumb.style.height = `${thumbHeight}px`
    thumb.style.transform = `translateY(${thumbOffset}px)`
  }

  function requestScrollbarSync() {
    if (scrollAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollAnimationFrameRef.current)
    }

    scrollAnimationFrameRef.current = window.requestAnimationFrame(() => {
      syncCustomScrollbar()
      scrollAnimationFrameRef.current = null
    })
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    setSelectedDocumentIds((current) =>
      current.filter((documentId) =>
        documents.some((document) => document.id === documentId),
      ),
    )
  }, [documents])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const root = document.getElementById('root')
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPaddingRight = document.body.style.paddingRight
    const previousAriaHidden = root?.getAttribute('aria-hidden') ?? null
    const hadInert = root?.hasAttribute('inert') ?? false
    const scrollbarCompensation = window.innerWidth - document.documentElement.clientWidth

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    if (scrollbarCompensation > 0) {
      document.body.style.paddingRight = `${scrollbarCompensation}px`
    }

    if (root) {
      root.setAttribute('aria-hidden', 'true')
      root.setAttribute('inert', '')
    }

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.paddingRight = previousBodyPaddingRight

      if (!root) {
        return
      }

      if (previousAriaHidden === null) {
        root.removeAttribute('aria-hidden')
      } else {
        root.setAttribute('aria-hidden', previousAriaHidden)
      }

      if (!hadInert) {
        root.removeAttribute('inert')
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    requestScrollbarSync()

    function handleResize() {
      requestScrollbarSync()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)

      if (scrollAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current)
        scrollAnimationFrameRef.current = null
      }
    }
  }, [documents.length, exportMode, isOpen])

  if (!isOpen) {
    return null
  }

  function toggleDocument(documentId: number) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    )
  }

  async function handleExportSubmit() {
    const identifiers =
      exportMode === 'corpus'
        ? ['corpus']
        : selectedDocumentIds.map((documentId) => String(documentId))

    if (identifiers.length === 0) {
      return
    }

    setIsExporting(true)

    try {
      await onExport(identifiers)
      onClose()
    } finally {
      setIsExporting(false)
    }
  }

  const isSelectedExportDisabled =
    exportMode === 'selected' && selectedDocumentIds.length === 0

  const modalContent = (
    <div
      aria-modal="true"
      className={styles.backdrop}
      role="dialog"
      onClick={onClose}
    >
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <p className={styles.kicker}>Экспорт CSV</p>
          <h3 className={styles.title}>Настройка экспорта</h3>
        </div>

        <div className={styles.modes}>
          <label className={styles.modeCard}>
            <input
              checked={exportMode === 'corpus'}
              name="export-mode"
              type="radio"
              onChange={() => setExportMode('corpus')}
            />
            <div className={styles.modeIcon}>
              <FileSpreadsheet aria-hidden="true" size={18} strokeWidth={1.8} />
            </div>
            <div className={styles.modeText}>
              <strong>Вся аналитика одним CSV</strong>
              <span>Скачать общий CSV по всем документам</span>
            </div>
          </label>

          <label className={styles.modeCard}>
            <input
              checked={exportMode === 'selected'}
              name="export-mode"
              type="radio"
              onChange={() => setExportMode('selected')}
            />
            <div className={styles.modeIcon}>
              <Files aria-hidden="true" size={18} strokeWidth={1.8} />
            </div>
            <div className={styles.modeText}>
              <strong>Выбранные документы</strong>
              <span>Выберите файлы, которые хотите экспортировать</span>
            </div>
          </label>
        </div>

        <div
          aria-hidden={exportMode !== 'selected'}
          className={`${styles.selectionBlock}${exportMode === 'selected' ? '' : ` ${styles.selectionBlockHidden}`}`}
        >
          <div className={styles.selectionHeader}>
            <span>Документы для экспорта</span>
            <button
              className={sharedButtonStyles.buttonSecondary}
              type="button"
              onClick={() =>
                setSelectedDocumentIds(
                  selectedDocumentIds.length === documents.length
                    ? []
                    : documents.map((document) => document.id),
                )
              }
            >
              <ListChecks aria-hidden="true" size={16} strokeWidth={1.9} />
              {selectedDocumentIds.length === documents.length
                ? 'Снять выбор'
                : 'Выбрать все'}
            </button>
          </div>

          {documents.length > 0 ? (
            <div className={styles.documentListWrap}>
              <div
                ref={documentListRef}
                className={styles.documentList}
                onScroll={requestScrollbarSync}
              >
                {documents.map((document, index) => {
                  const isChecked = selectedDocumentIds.includes(document.id)

                  return (
                    <label key={document.id} className={styles.documentOption}>
                      <input
                        checked={isChecked}
                        type="checkbox"
                        onChange={() => toggleDocument(document.id)}
                      />
                      <span>{getDocumentDisplayName(document, index)}</span>
                    </label>
                  )
                })}
              </div>

              <div
                ref={scrollbarTrackRef}
                aria-hidden="true"
                className={styles.customScrollbar}
                data-visible="false"
              >
                <div ref={scrollbarThumbRef} className={styles.customScrollbarThumb} />
              </div>
            </div>
          ) : (
            <p className={styles.hint}>Нет доступных данных для экспорта</p>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={sharedButtonStyles.buttonSecondary}
            disabled={isExporting}
            type="button"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className={sharedButtonStyles.buttonPrimary}
            disabled={isExporting || isSelectedExportDisabled}
            type="button"
            onClick={handleExportSubmit}
          >
            <Download aria-hidden="true" size={16} strokeWidth={1.9} />
            {isExporting ? 'Экспортируем...' : 'Скачать CSV'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
