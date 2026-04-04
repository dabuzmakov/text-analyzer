import styles from './Toast.module.css'

type ToastProps = {
  message: string
  type: 'success' | 'error'
  isVisible: boolean
}

export function Toast({ message, type, isVisible }: ToastProps) {
  const className = [
    styles.toast,
    type === 'success' ? styles.success : styles.error,
    isVisible ? styles.visible : styles.hidden,
  ].join(' ')

  return (
    <div className={styles.container} aria-atomic="true" aria-live="polite">
      <div className={className}>{message}</div>
    </div>
  )
}
