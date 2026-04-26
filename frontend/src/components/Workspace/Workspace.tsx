import { FiltersPanel } from '../FiltersPanel'
import { ResultPanel } from '../ResultPanel'
import type { AnalysisParams, AnalysisResponse, UiDocument } from '../../shared/types'
import styles from './Workspace.module.css'

type WorkspaceProps = {
  analysisError: string
  analysisParams: AnalysisParams
  analysisResult: AnalysisResponse['data'] | null
  canAnalyze: boolean
  canExport: boolean
  documents: UiDocument[]
  isAnalyzing: boolean
  isSaving: boolean
  onAnalyze: () => void
  onChangeAnalysisParam: (field: keyof AnalysisParams, value: string) => void
  onExport: (identifiers: string[]) => Promise<void>
}

export function Workspace({
  analysisError,
  analysisParams,
  analysisResult,
  canAnalyze,
  canExport,
  documents,
  isAnalyzing,
  isSaving,
  onAnalyze,
  onChangeAnalysisParam,
  onExport,
}: WorkspaceProps) {
  return (
    <section className={styles.workspace}>
      <FiltersPanel
        analysisParams={analysisParams}
        canAnalyze={canAnalyze}
        canExport={canExport}
        documents={documents}
        isAnalyzing={isAnalyzing}
        isSaving={isSaving}
        onAnalyze={onAnalyze}
        onChange={onChangeAnalysisParam}
        onExport={onExport}
      />

      <div className={styles.divider} aria-hidden="true" />

      <ResultPanel
        analysisError={analysisError}
        analysisResult={analysisResult}
        isAnalyzing={isAnalyzing}
      />
    </section>
  )
}
