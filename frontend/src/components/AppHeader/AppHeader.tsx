import { TextSearch } from 'lucide-react'
import styles from './AppHeader.module.css'

export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.badge}>
          <span className={styles.iconWrap}>
            <TextSearch aria-hidden="true" size={18} strokeWidth={2} />
          </span>
          <span className={styles.brandText}>
            <strong>Лексема</strong>
            <span>Частотный анализ текстов</span>
          </span>
        </div>
      </div>
    </header>
  )
}
