import { Check, Languages, Scale } from 'lucide-react'
import styles from './App.module.css'
import { DocumentModal } from './components/DocumentModal'
import { DocumentsTab } from './components/DocumentsTab'
import { LogoMark } from './components/LogoMark'
import { PlaceholderTab } from './components/PlaceholderTab'
import { SeoTab } from './components/SeoTab'
import { SettingsTab } from './components/SettingsTab'
import { Sidebar } from './components/Sidebar'
import { splitTextarea } from './shared/utils/lexema'
import { useLexemaApp } from './hooks/useLexemaApp'

export default function App() {
  const app = useLexemaApp()

  if (app.isAppLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.logoMark}>
          <LogoMark />
        </div>
        <p>Загружаем Лексему...</p>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <input
        ref={app.fileInputRef}
        className={styles.hiddenInput}
        type="file"
        accept=".txt,text/plain"
        multiple
        onChange={app.handleFileInput}
      />

      {app.message ? (
        <div className={`${styles.toast} ${app.message.variant === 'copy' ? styles.copyFeedback : ''}`} role="status">
          {app.message.variant === 'copy' ? <Check size={15} /> : null}
          <span>{app.message.text}</span>
        </div>
      ) : null}

      <Sidebar
        activeTab={app.activeTab}
        canUpload={app.canUpload}
        documentCount={app.documents.length}
        onOpenFilePicker={app.openFilePicker}
        onSetActiveTab={app.setActiveTab}
        onUploadFiles={app.handleFiles}
      />

      <div className={styles.workspace}>
        <main className={styles.content}>
          {app.activeTab === 'seo' ? (
            <SeoTab
              documents={app.documents}
              isAnalyzing={app.isAnalyzing}
              isExporting={app.isExporting}
              onAnalyze={app.handleRunSeoAnalysis}
              onCopyKeywordsMarkdown={app.copyKeywordsMarkdown}
              onCopyNgramsMarkdown={app.copyNgramsMarkdown}
              onCopyWordsMarkdown={app.copyWordsMarkdown}
              onCsvExport={app.handleCsvExport}
              onOpenFilePicker={app.openFilePicker}
              onOpenSettings={() => app.setActiveTab('settings')}
              onSelectAll={() => app.setSelectedSeoDocumentIds(app.documents.map((document) => document.id))}
              onSelectNone={() => app.setSelectedSeoDocumentIds([])}
              onToggleDocument={app.toggleSeoDocument}
              selectedDocumentIds={app.selectedSeoDocumentIds}
              selectedDocuments={app.selectedSeoDocuments}
              seoResult={app.seoResult}
              settings={app.settings}
            />
          ) : null}

          {app.activeTab === 'documents' ? (
            <DocumentsTab
              canUpload={app.canUpload}
              corpusSummary={app.corpusSummary}
              documentSearch={app.documentSearch}
              documents={app.documents}
              filteredDocuments={app.filteredDocuments}
              isSaving={app.isDocumentSaving}
              onCreate={app.openCreateDocumentModal}
              onDelete={app.handleDeleteDocument}
              onDeleteSelected={app.handleDeleteSelectedDocuments}
              onEdit={app.openEditDocumentModal}
              onOpenFilePicker={app.openFilePicker}
              onSearch={app.setDocumentSearch}
              onSelect={app.toggleDocumentSelection}
              onSelectAll={(checked) =>
                app.setSelectedDocumentIds(checked ? app.filteredDocuments.map((document) => document.id) : [])
              }
              onUploadFiles={app.handleFiles}
              selectedDocumentIds={app.selectedDocumentIds}
            />
          ) : null}

          {app.activeTab === 'settings' ? (
            <SettingsTab
              draft={app.settingsDraft}
              isSaving={app.isSettingsSaving}
              onReset={app.resetSettingsDraft}
              onSave={app.handleSaveSettings}
              onSetKeywords={(value) =>
                app.updateSettingsDraft({
                  keywords: splitTextarea(value),
                })
              }
              onSetLemmatization={(value) => app.updateSettingsDraft({ lemmatization: value })}
              onSetSpamThreshold={(value) =>
                app.updateSettingsDraft({
                  spam: {
                    threshold_percent: value,
                  },
                })
              }
              onSetStopWords={(value) =>
                app.updateSettingsDraft({
                  stop_words: {
                    ...app.settingsDraft.stop_words,
                    custom: splitTextarea(value),
                  },
                })
              }
              onSetStopWordsMode={app.setStopWordsMode}
              onToggleNgramSize={app.toggleNgramSize}
            />
          ) : null}

          {app.activeTab === 'compare' ? (
            <PlaceholderTab
              icon={<Scale size={30} />}
              title="Сравнительный анализ"
              text="Здесь можно будет сравнивать два документа по ключевым словам, плотности и тематическим фразам."
            />
          ) : null}

          {app.activeTab === 'spelling' ? (
            <PlaceholderTab
              icon={<Languages size={30} />}
              title="Проверить орфографию"
              text="Здесь появится проверка орфографии, грамматики и стилистики текста."
            />
          ) : null}
        </main>
      </div>

      {app.modal ? (
        <DocumentModal
          isSaving={app.isDocumentSaving}
          modal={app.modal}
          onChange={app.setModal}
          onClose={() => app.setModal(null)}
          onSubmit={app.handleDocumentSubmit}
        />
      ) : null}
    </div>
  )
}
