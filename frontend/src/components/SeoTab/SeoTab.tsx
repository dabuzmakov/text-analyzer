import { BarChart3, Lock } from 'lucide-react'
import styles from '../../App.module.css'
import { PageTitle } from '../PageTitle'
import { SeoDocumentPicker } from './SeoDocumentPicker'
import { SeoReport } from './SeoReport'
import { SeoUsedSettingsCard } from './SeoUsedSettingsCard'
import { SeoWelcomeState } from './SeoWelcomeState'
import type { SeoTabProps } from './types'

export function SeoTab({
  documents,
  isAnalyzing,
  isExporting,
  onAnalyze,
  onCopyKeywordsMarkdown,
  onCopyNgramsMarkdown,
  onCopyWordsMarkdown,
  onCsvExport,
  onOpenFilePicker,
  onOpenSettings,
  onSelectAll,
  onSelectNone,
  onToggleDocument,
  selectedDocumentIds,
  selectedDocuments,
  seoResult,
  settings,
}: SeoTabProps) {
  if (documents.length === 0) {
    return <SeoWelcomeState onOpenFilePicker={onOpenFilePicker} />
  }

  const result = seoResult?.result

  return (
    <div className={`${styles.pageStack} ${styles.seoPage}`}>
      <PageTitle
        title="SEO-анализ"
        text="Быстрая проверка текста по SEO-метрикам"
      />

      <div className={styles.analysisTopGrid}>
        <SeoDocumentPicker
          documents={documents}
          isAnalyzing={isAnalyzing}
          onAnalyze={onAnalyze}
          onSelectAll={onSelectAll}
          onSelectNone={onSelectNone}
          onToggleDocument={onToggleDocument}
          selectedDocumentIds={selectedDocumentIds}
        />
        <SeoUsedSettingsCard settings={settings} onOpenSettings={onOpenSettings} />
      </div>

      {!result ? (
        <>
          <section className={styles.emptyReport}>
            <BarChart3 size={68} />
            <h2>SEO-анализ еще не выполнен</h2>
            <p>
              Выберите документы и нажмите «Анализировать», чтобы получить частотность,
              ключевые фразы, водность, переспам и структуру текста.
            </p>
          </section>
          <LockedSections />
        </>
      ) : (
        <SeoReport
          isExporting={isExporting}
          onAnalyze={onAnalyze}
          onCopyKeywordsMarkdown={onCopyKeywordsMarkdown}
          onCopyNgramsMarkdown={onCopyNgramsMarkdown}
          onCopyWordsMarkdown={onCopyWordsMarkdown}
          onCsvExport={onCsvExport}
          result={result}
          selectedDocuments={selectedDocuments}
          seoResult={seoResult}
          settings={settings}
        />
      )}
    </div>
  )
}

function LockedSections() {
  return (
    <div className={styles.lockedList}>
      {['Сводка', 'Анализируемый текст', 'Топ слов', 'Топ N-грамм', 'Ключевые слова', 'Структура'].map((item) => (
        <div className={styles.lockedRow} key={item}>
          <Lock size={18} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}
