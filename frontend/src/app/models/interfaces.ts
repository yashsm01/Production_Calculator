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
  categoryIds?: (Category | string)[];
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
  parameterLabels?: Record<string, string>;
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
  bgColor?: string;
  fontColor?: string;
}

export interface ReportTemplate {
  _id?: string;
  productId?: string;
  masterProductId?: string;
  sourceType?: 'product' | 'master';
  templateName?: string;
  description?: string;
  rowCount: number;
  colCount: number;
  cells: ReportTemplateCell[];
  colWidths?: number[];
  rowHeights?: number[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportHistory {
  _id: string;
  productId: string;
  productName: string;
  categoryName: string;
  inputs: Record<string, number>;
  calculated: Record<string, number>;
  notes: string;
  savedAt: string;
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

// ── Master Product ─────────────────────────────────────────────────────────────

export interface MasterProductRef {
  productId: string | Product;
  alias: string;
}

export interface MasterParam {
  key: string;
  name: string;
  formula: string;
  unit?: string;
  index?: number;
}

export interface MasterProduct {
  _id?: string;
  name: string;
  description?: string;
  productRefs: MasterProductRef[];
  masterParams: MasterParam[];
  computed?: Record<string, number>;
  scope?: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MasterRefDetail {
  productId: string;
  alias: string;
  productName: string;
  categoryName: string;
  values: Record<string, number>;
}

export interface MasterProductResult {
  master: MasterProduct;
  refDetails: MasterRefDetail[];
  scope: Record<string, number>;
  inputKeys?: string[];
}

