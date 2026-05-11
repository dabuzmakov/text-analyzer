import type { ReactNode } from 'react'
import styles from '../../App.module.css'

export function PlaceholderTab({
  icon,
  text,
  title,
}: {
  icon: ReactNode
  text: string
  title: string
}) {
  return (
    <section className={styles.placeholder}>
      <span>{icon}</span>
      <h1>{title}</h1>
      <strong>В разработке</strong>
      <p>{text}</p>
    </section>
  )
}
