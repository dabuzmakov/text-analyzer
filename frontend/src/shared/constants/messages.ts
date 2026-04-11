export const APP_MESSAGES = {
  saveSuccess: 'Документы сохранены',
  unexpectedError: 'Произошла непредвиденная ошибка',
  requestError: (status: number) => `Ошибка запроса: ${status}`,
  invalidServerResponse: 'Сервер вернул некорректный ответ',
  missingApiBaseUrl: 'VITE_API_BASE_URL не определен.',
  downloadCsvError: 'Не удалось скачать CSV',
} as const
