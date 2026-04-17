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
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  _id: string;
  name: string;
  categoryId: Category;
  inputs: Record<string, number>;
  calculated: Record<string, number>;
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
