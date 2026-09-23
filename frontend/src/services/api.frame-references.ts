import { apiFetch } from './api-client';
import type { ForbiddenFrameReference } from './api.types';

export function getForbiddenFrameReferences(): Promise<ForbiddenFrameReference[]> {
  return apiFetch<ForbiddenFrameReference[]>('/api/frame-references');
}

export function createForbiddenFrameReference(
  label: string,
  file: File,
): Promise<ForbiddenFrameReference> {
  const body = new FormData();
  body.append('label', label);
  body.append('file', file);

  return apiFetch<ForbiddenFrameReference>('/api/frame-references', {
    method: 'POST',
    body,
  });
}

export function updateForbiddenFrameReference(
  id: string,
  label: string,
): Promise<ForbiddenFrameReference> {
  return apiFetch<ForbiddenFrameReference>(`/api/frame-references/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ label }),
  });
}

export function deleteForbiddenFrameReference(id: string): Promise<{ deleted: true }> {
  return apiFetch<{ deleted: true }>(`/api/frame-references/${id}`, {
    method: 'DELETE',
  });
}
