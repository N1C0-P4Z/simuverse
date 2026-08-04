/**
 * Shared file-upload constants used by both client (apps/web) and server (apps/api-nest).
 * Single source of truth for allowed extensions and their MIME types.
 */
export declare const ALLOWED_EXTENSIONS: readonly [".xls", ".xlsx", ".csv", ".pdf", ".doc", ".docx"];
export declare const MIME_MAP: Record<(typeof ALLOWED_EXTENSIONS)[number], string>;
