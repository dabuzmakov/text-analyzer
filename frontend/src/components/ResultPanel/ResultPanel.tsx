import { ChartColumn, CircleAlert, LoaderCircle } from 'lucide-react'
import type { AnalysisResponse } from '../../shared/types'
import { ResultSummary } from './ResultSummary'
import { ResultTable } from './ResultTable'
import styles from './ResultPanel.module.css'

type ResultPanelProps = {
  analysisResult: AnalysisResponse['data'] | null
  analysisError: string
  isAnalyzing: boolean
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

export function ResultPanel({
  analysisError,
  analysisResult,
  isAnalyzing,
}: ResultPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <p className={styles.kicker}>Результаты анализа</p>
        <h2 className={styles.title}>Таблица частот</h2>
      </div>

      {isAnalyzing ? (
        <div className={styles.state}>
          <div>
            <LoaderCircle aria-hidden="true" className={styles.loader} strokeWidth={1.9} />
            <p>Идёт анализ документов...</p>
          </div>
        </div>
      ) : analysisError ? (
        <div className={`${styles.state} ${styles.errorState}`}>
          <div>
            <CircleAlert aria-hidden="true" className={styles.stateIcon} strokeWidth={1.8} />
            <h3>Не удалось выполнить анализ</h3>
            <p>{analysisError}</p>
          </div>
        </div>
      ) : analysisResult ? (
        <div className={styles.resultLayout}>
          <ResultTable formatNumber={formatNumber} rows={analysisResult.table} />
          <aside className={styles.summaryAside}>
            <ResultSummary formatNumber={formatNumber} summary={analysisResult.summary} />
          </aside>
        </div>
      ) : (
        <div className={styles.state}>
          <div>
            <ChartColumn aria-hidden="true" className={styles.stateIcon} strokeWidth={1.8} />
            <h3>Анализ ещё не выполнен</h3>
            <p>Добавьте или измените тексты, дождитесь сохранения и запустите анализ, чтобы увидеть результаты</p>
          </div>
        </div>
      )}
    </section>
  )
}
