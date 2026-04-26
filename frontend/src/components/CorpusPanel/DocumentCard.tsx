import { FileText, Pencil, Trash2 } from 'lucide-react'
import styles from './CorpusPanel.module.css'

type DocumentCardProps = {
  title: string
  onEdit: () => void
  onRemove: () => void
}

export function DocumentCard({ title, onEdit, onRemove }: DocumentCardProps) {
  return (
    <article className={styles.card}>
      <span className={styles.cardIcon}>
        <FileText aria-hidden="true" size={16} strokeWidth={1.9} />
      </span>

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
          <Pencil aria-hidden="true" className={styles.icon} strokeWidth={1.8} />
        </button>

        <button
          aria-label="Удалить документ"
          className={styles.iconButton}
          type="button"
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" className={styles.icon} strokeWidth={1.8} />
        </button>
      </div>
    </article>
  )
}
