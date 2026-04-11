import type { AnalysisResponse } from '../../shared/types'
import styles from './ResultPanel.module.css'

type ResultTableProps = {
  rows: AnalysisResponse['data']['table']
  formatNumber: (value: number) => string
}

export function ResultTable({ rows, formatNumber }: ResultTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Слово</th>
            <th>Количество</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr key={row.word}>
                <td>{row.word}</td>
                <td>{formatNumber(row.count)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className={styles.emptyTableCell}>
                По выбранным параметрам данные не найдены
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
