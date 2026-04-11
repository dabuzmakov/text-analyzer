import { useEffect, useState } from 'react'
import type { AnalysisResponse, UiDocument } from '../../shared/types'
import { ExportModal } from '../ExportModal'
import sharedButtonStyles from '../../shared/styles/buttonStyles.module.css'
import { ResultSummary } from './ResultSummary'
import { ResultTable } from './ResultTable'
import styles from './ResultPanel.module.css'

type ResultPanelProps = {
  analysisResult: AnalysisResponse['data'] | null
  analysisError: string
  isAnalyzing: boolean
  isSaving: boolean
  canAnalyze: boolean
  saveDisabled: boolean
  canExport: boolean
  documents: UiDocument[]
  onSave: () => void
  onAnalyze: () => void
  onExport: (identifiers: string[]) => Promise<void>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

export function ResultPanel({
  analysisError,
  analysisResult,
  canAnalyze,
  canExport,
  documents,
  isAnalyzing,
  isSaving,
  onAnalyze,
  onExport,
  onSave,
  saveDisabled,
}: ResultPanelProps) {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  useEffect(() => {
    if (!canExport) {
      setIsExportModalOpen(false)
    }
  }, [canExport])

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.heading}>
          <p className={styles.kicker}>Результат анализа</p>
          <h2 className={styles.title}>Таблица частот</h2>
        </div>

        {isAnalyzing ? (
          <div className={styles.state}>
            <div>
              <div className={styles.loader} />
              <p>Идёт анализ документов...</p>
            </div>
          </div>
        ) : analysisError ? (
          <div className={`${styles.state} ${styles.errorState}`}>
            <div>
              <h3>Не удалось выполнить анализ</h3>
              <p>{analysisError}</p>
            </div>
          </div>
        ) : analysisResult ? (
          <>
            <ResultSummary formatNumber={formatNumber} summary={analysisResult.summary} />
            <ResultTable formatNumber={formatNumber} rows={analysisResult.table} />
          </>
        ) : (
          <div className={styles.state}>
            <div>
              <h3>Анализ ещё не выполнен</h3>
              <p>Сохраните тексты и запустите анализ, чтобы увидеть результаты</p>
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.actions}>
            <button
              className={sharedButtonStyles.buttonSecondary}
              disabled={saveDisabled}
              type="button"
              onClick={onSave}
            >
              {isSaving ? 'Сохраняем...' : 'Сохранить'}
            </button>

            <button
              className={sharedButtonStyles.buttonPrimary}
              disabled={!canAnalyze}
              type="button"
              onClick={onAnalyze}
            >
              {isAnalyzing ? 'Анализируем...' : 'Анализ'}
            </button>
          </div>

          {canExport ? (
            <div className={styles.exportWrap}>
              <button
                className={sharedButtonStyles.buttonSecondary}
                type="button"
                onClick={() => setIsExportModalOpen(true)}
              >
                Экспорт CSV
              </button>
            </div>
          ) : null}
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
