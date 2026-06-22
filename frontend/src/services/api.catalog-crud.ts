import { apiFetch } from './api-client';
import type { CatalogEntity, CatalogItem, CatalogListResponse } from './api.types';

type CatalogListParams = {
  search?: string;
  enabled?: string;
  limit?: number;
  offset?: number;
};

export function listCatalog<T = CatalogItem>(
  entity: CatalogEntity,
  params: CatalogListParams = {},
): Promise<CatalogListResponse<T>> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }

  return apiFetch<CatalogListResponse<T>>(`/api/catalog/${entity}${query.toString() ? `?${query}` : ''}`);
}

export function getCatalog<T = CatalogItem>(entity: CatalogEntity, id: string): Promise<T> {
  return apiFetch<T>(`/api/catalog/${entity}/${id}`);
}

export function createCatalog<T = CatalogItem>(
  entity: CatalogEntity,
  payload: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(`/api/catalog/${entity}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCatalog<T = CatalogItem>(
  entity: CatalogEntity,
  id: string,
  payload: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(`/api/catalog/${entity}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteCatalog(entity: CatalogEntity, id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/catalog/${entity}/${id}`, { method: 'DELETE' });
}

export function listCatalogRelation<T = CatalogItem>(path: string): Promise<CatalogListResponse<T>> {
  return apiFetch<CatalogListResponse<T>>(`/api/catalog/${path}`);
}

export function createCatalogRelation<T = CatalogItem>(path: string, payload: Record<string, unknown>): Promise<T> {
  return apiFetch<T>(`/api/catalog/${path}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCatalogRelation<T = CatalogItem>(
  path: string,
  relationId: string,
  payload: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(`/api/catalog/${path}/${relationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteCatalogRelation(path: string, relationId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/catalog/${path}/${relationId}`, { method: 'DELETE' });
}
