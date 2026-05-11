import styles from '../../App.module.css'

export function PageTitle({ title, text }: { title: string; text: string }) {
  return (
    <header className={styles.pageTitle}>
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  )
}
