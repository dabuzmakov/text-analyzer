import type { AnalysisResult } from '../../shared/types'
import styles from './ResultPanel.module.css'

type ResultPanelProps = {
  analysisResult: AnalysisResult | null
  analysisError: string
  isAnalyzing: boolean
  isSaving: boolean
  canAnalyze: boolean
  saveDisabled: boolean
  onSave: () => void
  onAnalyze: () => void
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

export function ResultPanel({
  analysisError,
  analysisResult,
  canAnalyze,
  isAnalyzing,
  isSaving,
  onAnalyze,
  onSave,
  saveDisabled,
}: ResultPanelProps) {
  return (
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
          <div className={styles.summary}>
            <article className={styles.summaryCard}>
              <span>Документы</span>
              <strong>{formatNumber(analysisResult.summary.documents_count)}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Слов до фильтров</span>
              <strong>
                {formatNumber(analysisResult.summary.total_words_before_filters)}
              </strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Слов после фильтров</span>
              <strong>
                {formatNumber(analysisResult.summary.total_words_after_filters)}
              </strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Уникальные слова</span>
              <strong>{formatNumber(analysisResult.summary.unique_words)}</strong>
            </article>
          </div>

          <div className={styles.applied}>
            <span>Топ-N слов: {analysisResult.applied_filters.top_n}</span>
            <span>Длина слова от: {analysisResult.applied_filters.min_word_length}</span>
            <span>
              Сортировка:{' '}
              {analysisResult.applied_filters.order_by === 'desc'
                ? 'по убыванию'
                : 'по возрастанию'}
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Слово</th>
                  <th>Количество</th>
                </tr>
              </thead>
              <tbody>
                {analysisResult.table.map((row) => (
                  <tr key={row.word}>
                    <td>{row.word}</td>
                    <td>{formatNumber(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className={styles.state}>
          <div>
            <h3>Анализ ещё не выполнен</h3>
            <p>Сохраните тексты и запустите анализ, чтобы увидеть результаты</p>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.lightButton}
          disabled={saveDisabled}
          type="button"
          onClick={onSave}
        >
          {isSaving ? 'Сохраняем...' : 'Сохранить'}
        </button>

        <button
          className={styles.darkButton}
          disabled={!canAnalyze}
          type="button"
          onClick={onAnalyze}
        >
          {isAnalyzing ? 'Анализируем...' : 'Анализ'}
        </button>
      </div>
    </section>
  )
}
