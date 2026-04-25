export interface Category {
  _id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Unit {
  _id: string;
  name: string;
  symbol: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HeaderInfo {
  _id: string;
  name: string;
  description?: string;
  index?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Parameter {
  _id: string;
  name: string;
  key: string;
  type?: 'input' | 'formula';
  formula: string;
  unit?: Unit | null;
  headerInfoId?: HeaderInfo | null;
  categoryId?: Category | null;
  index?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  _id: string;
  name: string;
  categoryId: Category;
  inputs: Record<string, number>;
  calculated: Record<string, number>;
  hiddenParameters?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportTemplateCell {
  row: number;
  col: number;
  type: 'text' | 'parameter';
  content: string; // text string or parameter key
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  colSpan?: number;
  rowSpan?: number;
  thickBorder?: boolean;
}

export interface ReportTemplate {
  _id?: string;
  productId: string;
  rowCount: number;
  colCount: number;
  cells: ReportTemplateCell[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FormulaValidationResult {
  valid: boolean;
  variables?: string[];
  error?: string;
}

export interface EngineResult {
  product: Product;
  scope: Record<string, number>;
  evaluationOrder: string[];
}

export interface InputVariablesResult {
  inputVariables: string[];
  parameters: Parameter[];
}
