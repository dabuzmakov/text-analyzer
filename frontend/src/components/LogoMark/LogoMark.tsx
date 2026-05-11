import styles from '../../App.module.css'

export function LogoMark() {
  return (
    <svg aria-hidden="true" className={styles.logoIcon} viewBox="0 0 48 48">
      <rect height="48" rx="13" width="48" />
      <path d="M12 19H34" />
      <path d="M12 31.5H22.6" />
      <circle cx="34" cy="31.5" r="3.2" />
    </svg>
  )
}
