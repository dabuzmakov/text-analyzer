import styles from './CorpusPanel.module.css'

type DocumentCardProps = {
  title: string
  onEdit: () => void
  onRemove: () => void
}

export function DocumentCard({ title, onEdit, onRemove }: DocumentCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTitleWrap}>
        <h3 className={styles.cardTitle}>{title}</h3>
      </div>

      <div className={styles.cardActions}>
        <button
          aria-label="Редактировать документ"
          className={styles.iconButton}
          type="button"
          onClick={onEdit}
        >
          <svg aria-hidden="true" className={styles.icon} viewBox="0 0 24 24">
            <path
              d="M4.5 19.5h3.75L18.5 9.25a1.77 1.77 0 0 0 0-2.5l-1.25-1.25a1.77 1.77 0 0 0-2.5 0L4.5 15.75V19.5Z"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
            <path
              d="m13.5 6.75 3.75 3.75"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
          </svg>
        </button>

        <button
          aria-label="Удалить документ"
          className={styles.iconButton}
          type="button"
          onClick={onRemove}
        >
          <svg aria-hidden="true" className={styles.icon} viewBox="0 0 24 24">
            <path
              d="M9 3.75h6m-9 3h12m-1.5 0-.53 10.61A2.25 2.25 0 0 1 13.72 19.5h-3.44a2.25 2.25 0 0 1-2.25-2.14L7.5 6.75m3 3.75v5.25m3-5.25v5.25"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
          </svg>
        </button>
      </div>
    </article>
  )
}
