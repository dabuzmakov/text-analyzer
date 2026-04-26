import { useEffect, useRef, useState } from 'react'
import type { AnalysisResponse } from '../../shared/types'
import styles from './ResultPanel.module.css'

const TABLE_SCROLLBAR_TOP_INSET = 54
const TABLE_SCROLLBAR_BOTTOM_INSET = 8

type ResultTableProps = {
  rows: AnalysisResponse['data']['table']
  formatNumber: (value: number) => string
}

export function ResultTable({ rows, formatNumber }: ResultTableProps) {
  const [scrollThumbHeight, setScrollThumbHeight] = useState(0)
  const [scrollThumbOffset, setScrollThumbOffset] = useState(0)
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

    const trackHeight = Math.max(
      clientHeight - TABLE_SCROLLBAR_TOP_INSET - TABLE_SCROLLBAR_BOTTOM_INSET,
      0,
    )
    const ratio = clientHeight / scrollHeight
    const thumbHeight = Math.max(trackHeight * ratio, 28)
    const maxOffset = trackHeight - thumbHeight
    const maxScroll = scrollHeight - clientHeight
    const thumbOffset = maxScroll > 0 ? (scrollTop / maxScroll) * maxOffset : 0

    setScrollThumbHeight(thumbHeight)
    setScrollThumbOffset(thumbOffset)
  }

  useEffect(() => {
    updateCustomScrollbar()
  }, [rows.length])

  return (
    <div className={styles.tableWrap}>
      <div
        ref={scrollAreaRef}
        className={styles.tableScrollArea}
        onScroll={updateCustomScrollbar}
      >
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

      {scrollThumbHeight > 0 ? (
        <div className={styles.tableCustomScrollbar} aria-hidden="true">
          <div
            className={styles.tableCustomScrollbarThumb}
            style={{
              height: `${scrollThumbHeight}px`,
              transform: `translateY(${scrollThumbOffset}px)`,
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
