"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIME_MAP = exports.ALLOWED_EXTENSIONS = void 0;
/**
 * Shared file-upload constants used by both client (apps/web) and server (apps/api-nest).
 * Single source of truth for allowed extensions and their MIME types.
 */
exports.ALLOWED_EXTENSIONS = [
    '.xls',
    '.xlsx',
    '.csv',
    '.pdf',
    '.doc',
    '.docx',
];
exports.MIME_MAP = {
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
//# sourceMappingURL=file-upload.js.map