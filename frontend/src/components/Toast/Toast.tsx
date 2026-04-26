import { CircleAlert, CircleCheck } from 'lucide-react'
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
      <div className={className}>
        {type === 'success' ? (
          <CircleCheck aria-hidden="true" size={17} strokeWidth={1.9} />
        ) : (
          <CircleAlert aria-hidden="true" size={17} strokeWidth={1.9} />
        )}
        <span>{message}</span>
      </div>
    </div>
  )
}
