import type { ChangeEvent, DragEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { UiDocument } from '../../shared/types'
import { DocumentCard } from './DocumentCard'
import styles from './CorpusPanel.module.css'

type CorpusPanelProps = {
  documents: UiDocument[]
  maxDocuments: number
  canUpload: boolean
  onFilesAdded: (files: File[]) => void
  onAddManual: () => void
  onEditDocument: (documentId: number) => void
  onRemoveDocument: (documentId: number) => void
}

export function CorpusPanel({
  documents,
  maxDocuments,
  canUpload,
  onFilesAdded,
  onAddManual,
  onEditDocument,
  onRemoveDocument,
}: CorpusPanelProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [scrollThumbHeight, setScrollThumbHeight] = useState(0)
  const [scrollThumbOffset, setScrollThumbOffset] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)

  function updateCustomScrollbar() {
    const element = scrollAreaRef.current

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

  useEffect(() => {
    updateCustomScrollbar()
  }, [documents.length])

  function openFilePicker() {
    if (!canUpload) {
      return
    }

    fileInputRef.current?.click()
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    onFilesAdded(files)
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!canUpload) {
      return
    }

    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (!canUpload) {
      return
    }

    event.preventDefault()
    setIsDragging(false)

    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.name.toLowerCase().endsWith('.txt'),
    )

    onFilesAdded(files)
  }

  const panelClass = isDragging ? `${styles.panel} ${styles.panelDragging}` : styles.panel
  const dropzoneClass = isDragging
    ? `${styles.dropzone} ${styles.dropzoneDragging}`
    : styles.dropzone

  return (
    <aside
      className={panelClass}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        accept=".txt,text/plain"
        className={styles.fileInput}
        disabled={!canUpload}
        multiple
        type="file"
        onChange={handleInputChange}
      />

      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>Контент</p>
          <h2 className={styles.title}>Документы</h2>
        </div>
        <span className={styles.count}>
          {documents.length}/{maxDocuments}
        </span>
      </div>

      {documents.length === 0 ? (
        <button
          className={dropzoneClass}
          disabled={!canUpload}
          type="button"
          onClick={openFilePicker}
        >
          <span className={styles.dropzoneTitle}>Перетащите .txt файлы в эту область</span>
          <span className={styles.dropzoneText}>или нажмите для выбора</span>
        </button>
      ) : (
        <div className={styles.contentArea}>
          <div
            ref={scrollAreaRef}
            className={styles.scrollArea}
            onScroll={updateCustomScrollbar}
          >
            <div className={styles.scrollInner}>
              {documents.map((document) => (
                <DocumentCard
                  key={document.id}
                  title={document.title}
                  onEdit={() => onEditDocument(document.id)}
                  onRemove={() => onRemoveDocument(document.id)}
                />
              ))}
            </div>
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
      )}

      <button className={styles.addButton} type="button" onClick={onAddManual}>
        +
      </button>

      {isDragging ? (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <strong>Отпустите, чтобы добавить файл</strong>
            <span>Поддерживается .txt формат</span>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
