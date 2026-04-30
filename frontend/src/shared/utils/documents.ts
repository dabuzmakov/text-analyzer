import type { UiDocument } from '../types'

export function createUiDocument(id: number, title: string, content: string): UiDocument {
  return {
    id,
    title,
    content,
  }
}

export function getDocumentDisplayName(document: UiDocument, index: number) {
  return document.title.trim() || `Документ ${index + 1}`
}

export function toCsvFileName(title: string) {
  const normalizedTitle = title.trim().replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
  return `${normalizedTitle || 'document'}.csv`
}
