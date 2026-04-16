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

export interface Parameter {
  _id: string;
  name: string;
  key: string;
  /** true → user provides value directly (no formula) */
  isInput: boolean;
  formula: string;
  unit?: Unit | null;
  categoryId?: Category | null;
  /**
   * Maps raw variable names in this formula to their display unit.
   * e.g. { "inputX": { symbol: "%" }, "inputY": { symbol: "$" } }
   * Populated by backend as _populatedVariableUnits.
   */
  variableUnits?: Record<string, string>;          // key → unit._id (for form)
  _populatedVariableUnits?: Record<string, Unit | null>; // key → Unit (from backend)
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
  inputParamVars?: string[];   // match isInput=true keys  → green chips
  formulaParamVars?: string[]; // match formula param keys → purple chips
  unknownVars?: string[];      // not defined yet          → amber chips (need unit)
  error?: string;
}

export interface EngineResult {
  product: Product;
  scope: Record<string, number>;
  evaluationOrder: string[];
}

/** A raw formula variable enriched with its optional unit */
export interface FormulaVariable {
  key: string;
  unit: Unit | null;
}

/**
 * Returned by GET /api/parameter/inputs?categoryId=xxx
 */
export interface InputVariablesResult {
  /** isInput=true params — user fills a labeled field (name + key + unit) */
  inputParameters: Parameter[];
  /** raw vars from formulas, NOT a param key, with unit metadata */
  formulaVariables: FormulaVariable[];
  /** non-input formula params — used by engine + dependency display */
  formulaParameters: Parameter[];
}
