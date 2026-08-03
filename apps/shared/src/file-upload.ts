/**
 * Shared file-upload constants used by both client (apps/web) and server (apps/api-nest).
 * Single source of truth for allowed extensions and their MIME types.
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
