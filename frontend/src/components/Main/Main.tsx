import { CorpusPanel } from '../CorpusPanel'
import { Workspace } from '../Workspace'
import type {
  AnalysisParams,
  AnalysisResponse,
  ExportIdentifier,
  UiDocument,
} from '../../shared/types'
import styles from './Main.module.css'

type MainProps = {
  analysisError: string
  analysisParams: AnalysisParams
  analysisResult: AnalysisResponse['data'] | null
  canAnalyze: boolean
  canExport: boolean
  canUpload: boolean
  documents: UiDocument[]
  isAnalyzing: boolean
  maxDocuments: number
  onAddManual: () => void
  onAnalyze: () => void
  onChangeAnalysisParam: (field: keyof AnalysisParams, value: string) => void
  onEditDocument: (documentId: number) => void
  onExport: (identifiers: ExportIdentifier[]) => Promise<void>
  onFilesAdded: (files: File[]) => void
  onRemoveDocument: (documentId: number) => void
}

export function Main({
  analysisError,
  analysisParams,
  analysisResult,
  canAnalyze,
  canExport,
  canUpload,
  documents,
  isAnalyzing,
  maxDocuments,
  onAddManual,
  onAnalyze,
  onChangeAnalysisParam,
  onEditDocument,
  onExport,
  onFilesAdded,
  onRemoveDocument,
}: MainProps) {
  return (
    <main className={styles.main}>
      <CorpusPanel
        canUpload={canUpload}
        documents={documents}
        maxDocuments={maxDocuments}
        onAddManual={onAddManual}
        onEditDocument={onEditDocument}
        onFilesAdded={onFilesAdded}
        onRemoveDocument={onRemoveDocument}
      />

      <Workspace
        analysisError={analysisError}
        analysisParams={analysisParams}
        analysisResult={analysisResult}
        canAnalyze={canAnalyze}
        canExport={canExport}
        documents={documents}
        isAnalyzing={isAnalyzing}
        onAnalyze={onAnalyze}
        onChangeAnalysisParam={onChangeAnalysisParam}
        onExport={onExport}
      />
    </main>
  )
}
