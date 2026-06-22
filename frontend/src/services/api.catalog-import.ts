import { apiFetch } from './api-client';
import type { ImportApplyResult, ImportPreviewResponse, ImportWizardPayload } from './api.types';

export function getImportSources(): Promise<{ items: string[] }> {
  return apiFetch<{ items: string[] }>('/api/catalog/import/sources');
}

export function previewCatalogImport(payload: ImportWizardPayload): Promise<ImportPreviewResponse> {
  return apiFetch<ImportPreviewResponse>('/api/catalog/import/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function applyCatalogImport(
  payload: ImportWizardPayload & { rows: Array<{ rowId: string; selectedProviderId: string | null }> },
): Promise<ImportApplyResult> {
  return apiFetch<ImportApplyResult>('/api/catalog/import/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
