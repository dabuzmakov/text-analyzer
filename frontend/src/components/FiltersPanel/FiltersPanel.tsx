import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, Play } from 'lucide-react'
import { ExportModal } from '../ExportModal'
import sharedButtonStyles from '../../shared/styles/buttonStyles.module.css'
import type { AnalysisParams, UiDocument } from '../../shared/types'
import { normalizePositiveIntegerString } from '../../shared/utils/analysisParams'
import styles from './FiltersPanel.module.css'

type FiltersPanelProps = {
  analysisParams: AnalysisParams
  canAnalyze: boolean
  canExport: boolean
  documents: UiDocument[]
  isAnalyzing: boolean
  isSaving: boolean
  onAnalyze: () => void
  onChange: (field: keyof AnalysisParams, value: string) => void
  onExport: (identifiers: string[]) => Promise<void>
}

const orderOptions = [
  { value: 'desc', label: 'По убыванию' },
  { value: 'asc', label: 'По возрастанию' },
] as const

export function FiltersPanel({
  analysisParams,
  canAnalyze,
  canExport,
  documents,
  isAnalyzing,
  isSaving,
  onAnalyze,
  onChange,
  onExport,
}: FiltersPanelProps) {
  const [isOrderOpen, setIsOrderOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [topNInput, setTopNInput] = useState(analysisParams.topN)
  const [minWordLengthInput, setMinWordLengthInput] = useState(
    analysisParams.minWordLength,
  )
  const orderRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!orderRef.current?.contains(event.target as Node)) {
        setIsOrderOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOrderOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    if (!canExport) {
      setIsExportModalOpen(false)
    }
  }, [canExport])

  useEffect(() => {
    setTopNInput(analysisParams.topN)
  }, [analysisParams.topN])

  useEffect(() => {
    setMinWordLengthInput(analysisParams.minWordLength)
  }, [analysisParams.minWordLength])

  const activeOrderLabel =
    orderOptions.find((option) => option.value === analysisParams.orderBy)?.label ||
    'По убыванию'

  function handleNumberFieldBlur(
    field: 'topN' | 'minWordLength',
    value: string,
    fallback: string,
  ) {
    const normalizedValue = normalizePositiveIntegerString(value)

    if (normalizedValue === null) {
      if (field === 'topN') {
        setTopNInput(fallback)
      } else {
        setMinWordLengthInput(fallback)
      }
      return
    }

    if (field === 'topN') {
      setTopNInput(normalizedValue)
    } else {
      setMinWordLengthInput(normalizedValue)
    }

    onChange(field, normalizedValue)
  }

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.content}>
          <div className={styles.heading}>
            <p className={styles.kicker}>Фильтры</p>
            <h2 className={styles.title}>Параметры анализа</h2>
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              <span>Топ-N слов</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                type="text"
                value={topNInput}
                onBlur={() =>
                  handleNumberFieldBlur('topN', topNInput, analysisParams.topN)
                }
                onChange={(event) => setTopNInput(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Длина слова от</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                type="text"
                value={minWordLengthInput}
                onBlur={() =>
                  handleNumberFieldBlur(
                    'minWordLength',
                    minWordLengthInput,
                    analysisParams.minWordLength,
                  )
                }
                onChange={(event) => setMinWordLengthInput(event.target.value)}
              />
            </label>

            <div ref={orderRef} className={`${styles.field} ${styles.orderField}`}>
              <span>Сортировка</span>

              <button
                aria-expanded={isOrderOpen}
                className={styles.selectButton}
                type="button"
                onClick={() => setIsOrderOpen((current) => !current)}
              >
                <span>{activeOrderLabel}</span>
                <span
                  className={`${styles.selectArrow}${isOrderOpen ? ` ${styles.selectArrowOpen}` : ''}`}
                >
                  <ChevronDown aria-hidden="true" size={16} strokeWidth={1.9} />
                </span>
              </button>

              {isOrderOpen ? (
                <div className={styles.selectMenu}>
                  {orderOptions.map((option) => {
                    const isActive = option.value === analysisParams.orderBy

                    return (
                      <button
                        key={option.value}
                        className={`${styles.selectOption}${isActive ? ` ${styles.selectOptionActive}` : ''}`}
                        type="button"
                        onClick={() => {
                          onChange('orderBy', option.value)
                          setIsOrderOpen(false)
                        }}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={sharedButtonStyles.buttonPrimary}
            disabled={!canAnalyze}
            type="button"
            onClick={onAnalyze}
          >
            <Play aria-hidden="true" size={16} strokeWidth={2} />
            Анализ
          </button>

          <button
            aria-hidden={!canExport}
            className={`${sharedButtonStyles.buttonSecondary}${canExport ? '' : ` ${styles.hiddenAction}`}`}
            disabled={!canExport}
            tabIndex={canExport ? 0 : -1}
            type="button"
            onClick={() => setIsExportModalOpen(true)}
          >
            <Download aria-hidden="true" size={16} strokeWidth={1.9} />
            Экспорт
          </button>
        </div>
      </section>

      <ExportModal
        documents={documents}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={onExport}
      />
    </>
  )
}
