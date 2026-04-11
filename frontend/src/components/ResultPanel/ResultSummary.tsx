import type { AnalysisResponse } from '../../shared/types'
import styles from './ResultPanel.module.css'

type ResultSummaryProps = {
  summary: AnalysisResponse['data']['summary']
  formatNumber: (value: number) => string
}

const summaryItems = [
  { key: 'documents_count', label: 'Документы' },
  { key: 'total_words', label: 'Всего слов' },
  { key: 'unique_words', label: 'Уникальные слова' },
] as const

export function ResultSummary({ summary, formatNumber }: ResultSummaryProps) {
  return (
    <div className={styles.summary}>
      {summaryItems.map((item) => (
        <article key={item.key} className={styles.summaryCard}>
          <span>{item.label}</span>
          <strong>{formatNumber(summary[item.key])}</strong>
        </article>
      ))}
    </div>
  )
}
