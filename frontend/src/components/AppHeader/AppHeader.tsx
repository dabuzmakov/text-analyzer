import styles from './AppHeader.module.css'

export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.badge}>
          <span className={styles.dot} />
          <span>Инструмент частотного анализа текстов</span>
        </div>
      </div>
    </header>
  )
}
