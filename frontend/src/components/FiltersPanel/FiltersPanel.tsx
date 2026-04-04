import { useEffect, useRef, useState } from 'react'
import type { AnalysisParams } from '../../shared/types'
import styles from './FiltersPanel.module.css'

type FiltersPanelProps = {
  analysisParams: AnalysisParams
  onChange: (field: keyof AnalysisParams, value: string) => void
}

const orderOptions = [
  { value: 'desc', label: 'По убыванию' },
  { value: 'asc', label: 'По возрастанию' },
] as const

export function FiltersPanel({ analysisParams, onChange }: FiltersPanelProps) {
  const [isOrderOpen, setIsOrderOpen] = useState(false)
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

  const activeOrderLabel =
    orderOptions.find((option) => option.value === analysisParams.orderBy)?.label ||
    'По убыванию'

  return (
    <section className={styles.panel}>
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
            value={analysisParams.topN}
            onChange={(event) => onChange('topN', event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Длина слов от:</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            type="text"
            value={analysisParams.minWordLength}
            onChange={(event) => onChange('minWordLength', event.target.value)}
          />
        </label>

        <div ref={orderRef} className={styles.field}>
          <span>Сортировка</span>

          <button
            aria-expanded={isOrderOpen}
            className={styles.selectButton}
            type="button"
            onClick={() => setIsOrderOpen((current) => !current)}
          >
            <span>{activeOrderLabel}</span>
            <span className={`${styles.selectArrow}${isOrderOpen ? ` ${styles.selectArrowOpen}` : ''}`}>
              <svg aria-hidden="true" viewBox="0 0 12 8">
                <path
                  d="M1 1.5L6 6.5L11 1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
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
    </section>
  )
}
