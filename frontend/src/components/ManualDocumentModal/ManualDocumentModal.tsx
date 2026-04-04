import type { FormEvent } from 'react'
import type { ManualForm } from '../../shared/types'
import styles from './ManualDocumentModal.module.css'

type ManualDocumentModalProps = {
  isOpen: boolean
  isEditing: boolean
  form: ManualForm
  onChange: (field: keyof ManualForm, value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function ManualDocumentModal({
  isOpen,
  isEditing,
  form,
  onChange,
  onClose,
  onSubmit,
}: ManualDocumentModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div aria-modal="true" className={styles.backdrop} role="dialog" onClick={onClose}>
      <div className={styles.card} onClick={(event) => event.stopPropagation()}>
        <div className={styles.heading}>
          <p className={styles.kicker}>
            {isEditing ? 'Редактирование текста' : 'Создание текста'}
          </p>
          <h2 className={styles.title}>
            {isEditing ? 'Изменить документ' : 'Новый документ'}
          </h2>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span>Название</span>
            <input
              required
              type="text"
              value={form.title}
              onChange={(event) => onChange('title', event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>Текст</span>
            <textarea
              required
              rows={10}
              value={form.content}
              onChange={(event) => onChange('content', event.target.value)}
            />
          </label>

          <div className={styles.actions}>
            <button className={styles.lightButton} type="button" onClick={onClose}>
              Отмена
            </button>
            <button className={styles.darkButton} type="submit">
              {isEditing ? 'Сохранить изменения' : 'Добавить текст'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
