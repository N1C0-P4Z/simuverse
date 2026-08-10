/**
 * Keep in sync with apps/shared/src/file-upload.ts
 * Local copy so Nest can compile under rootDir without resolving the
 * workspace package (Docker anonymous node_modules volume breaks the link).
 */
export const ALLOWED_EXTENSIONS = [
  '.xls',
  '.xlsx',
  '.csv',
  '.pdf',
  '.doc',
  '.docx',
] as const;

export const MIME_MAP: Record<(typeof ALLOWED_EXTENSIONS)[number], string> = {
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
