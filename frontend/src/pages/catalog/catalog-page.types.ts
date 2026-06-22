import type { CatalogEntity } from '../../services/api';

export type FieldType = 'text' | 'number' | 'textarea' | 'checkbox' | 'provider';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
}

export interface EntityConfig {
  entity: CatalogEntity;
  label: string;
  fields: FieldConfig[];
}

export interface FormGroup {
  title: string;
  description: string;
  fields: FieldConfig[];
}
