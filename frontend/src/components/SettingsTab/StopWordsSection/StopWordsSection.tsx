import styles from '../../../App.module.css'
import { stopWordsLabels } from '../../../shared/constants/lexema'
import { textFromList } from '../../../shared/utils/lexema'
import type { AnalysisSettings, StopWordsMode } from '../../../types/settings'
import { SettingLabel } from '../../SettingLabel'
import { SettingsTextareaField } from '../../SettingsTextareaField'

export function StopWordsSection({
  draft,
  onSetStopWords,
  onSetStopWordsMode,
}: {
  draft: AnalysisSettings
  onSetStopWords: (value: string) => void
  onSetStopWordsMode: (value: StopWordsMode) => void
}) {
  return (
    <>
      <div className={styles.settingsField}>
        <SettingLabel
          title="Использование стоп-слов"
          tooltip="Стоп-слова исключаются из частотных таблиц, чтобы служебные слова не искажали SEO-картину"
        />
        <div className={styles.segmented}>
          {(Object.keys(stopWordsLabels) as StopWordsMode[]).map((mode) => (
            <button
              className={draft.stop_words.mode === mode ? styles.segmentedActive : ''}
              key={mode}
              type="button"
              onClick={() => onSetStopWordsMode(mode)}
            >
              {stopWordsLabels[mode]}
            </button>
          ))}
        </div>
      </div>

      <SettingsTextareaField
        maxLength={5000}
        placeholder="Например: сайт, https, http, www, com"
        subtitle="Введите стоп-слова через запятую"
        title="Свои стоп-слова"
        tooltip="Собственный список помогает убрать из анализа брендовые, технические или нерелевантные для SEO слова"
        value={textFromList(draft.stop_words.custom)}
        onChange={onSetStopWords}
      />
    </>
  )
}
