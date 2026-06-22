import { BadRequestException } from '@nestjs/common';

export function parseLimit(value?: string): number {
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50;
}

export function parseOffset(value?: string): number {
  const offset = Number(value);
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required`);
  }

  return value.trim();
}

export function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function numberOrDefault(value: unknown, fallback: number): number {
  const normalized = numberOrNull(value);
  return normalized === null ? fallback : normalized;
}

export function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function uniqueOptionalIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
}

export function uniqueIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    throw new BadRequestException('ids array is required');
  }

  return uniqueOptionalIds(ids);
}
