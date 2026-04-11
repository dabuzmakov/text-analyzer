import { useEffect, useRef, useState } from 'react'
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
  const [scrollThumbHeight, setScrollThumbHeight] = useState(0)
  const [scrollThumbOffset, setScrollThumbOffset] = useState(0)
  const documentListRef = useRef<HTMLDivElement | null>(null)

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
    updateCustomScrollbar()
  }, [documents.length, exportMode, isOpen])

  if (!isOpen) {
    return null
  }

  function updateCustomScrollbar() {
    const element = documentListRef.current

    if (!element) {
      return
    }

    const { clientHeight, scrollHeight, scrollTop } = element

    if (scrollHeight <= clientHeight) {
      setScrollThumbHeight(0)
      setScrollThumbOffset(0)
      return
    }

    const ratio = clientHeight / scrollHeight
    const thumbHeight = Math.max(clientHeight * ratio, 28)
    const maxOffset = clientHeight - thumbHeight
    const maxScroll = scrollHeight - clientHeight
    const thumbOffset = maxScroll > 0 ? (scrollTop / maxScroll) * maxOffset : 0

    setScrollThumbHeight(thumbHeight)
    setScrollThumbOffset(thumbOffset)
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

  return (
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
            <div>
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
            <div>
              <strong>Выбранные документы</strong>
              <span>Выберите файлы, которые хотите экспортировать</span>
            </div>
          </label>
        </div>

        {exportMode === 'selected' ? (
          <div className={styles.selectionBlock}>
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
                  onScroll={updateCustomScrollbar}
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

                {scrollThumbHeight > 0 ? (
                  <div className={styles.customScrollbar} aria-hidden="true">
                    <div
                      className={styles.customScrollbarThumb}
                      style={{
                        height: `${scrollThumbHeight}px`,
                        transform: `translateY(${scrollThumbOffset}px)`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className={styles.hint}>Нет доступных данных для экспорта</p>
            )}
          </div>
        ) : null}

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
            {isExporting ? 'Экспортируем...' : 'Скачать CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}
