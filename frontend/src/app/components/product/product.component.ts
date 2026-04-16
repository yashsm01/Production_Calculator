import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import {
  Category, Product, EngineResult, Parameter,
  InputVariablesResult, FormulaVariable
} from '../../models/interfaces';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product.component.html',
  styleUrl: './product.component.css',
})
export class ProductComponent implements OnInit {
  products: Product[] = [];
  loadingProducts = false;

  categories: Category[] = [];
  selectedCategoryId = '';
  productName = '';

  /** isInput=true parameters — user fills labeled fields */
  inputParameters: Parameter[] = [];
  /** raw formula variables — user fills, each may have a unit */
  formulaVariables: FormulaVariable[] = [];
  /** non-input parameters — used by engine, shown in chain */
  formulaParameters: Parameter[] = [];

  /** Combined key → value (string) for all user inputs */
  inputValues: Record<string, string> = {};

  loadingInputs = false;
  submitting = false;
  error = '';
  success = '';
  lastResult: EngineResult | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadProducts();
    this.api.getCategories().subscribe((c) => (this.categories = c));
  }

  loadProducts(): void {
    this.loadingProducts = true;
    this.api.getProducts().subscribe({
      next: (d) => { this.products = d; this.loadingProducts = false; },
      error: () => (this.loadingProducts = false),
    });
  }

  onCategoryChange(): void {
    if (!this.selectedCategoryId) { this.resetInputs(); return; }
    this.loadingInputs = true;
    this.error = '';
    this.lastResult = null;
    this.inputValues = {};

    this.api.getInputVariables(this.selectedCategoryId).subscribe({
      next: (result: InputVariablesResult) => {
        this.inputParameters  = result.inputParameters;
        this.formulaVariables = result.formulaVariables;
        this.formulaParameters = result.formulaParameters;

        const init: Record<string, string> = {};
        for (const p of result.inputParameters) init[p.key] = '';
        for (const fv of result.formulaVariables) init[fv.key] = '';
        this.inputValues = init;
        this.loadingInputs = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load';
        this.loadingInputs = false;
      },
    });
  }

  resetInputs(): void {
    this.inputParameters = [];
    this.formulaVariables = [];
    this.formulaParameters = [];
    this.inputValues = {};
  }

  get totalInputCount(): number {
    return this.inputParameters.length + this.formulaVariables.length;
  }

  getParamUnit(param: Parameter): string {
    return param.unit ? (param.unit as any).symbol || '' : '';
  }

  getParamUnitName(param: Parameter): string {
    if (!param.unit) return '';
    const u = param.unit as any;
    return u.name ? `${u.name} (${u.symbol})` : u.symbol || '';
  }

  getFvUnitSymbol(fv: FormulaVariable): string {
    return fv.unit?.symbol || '';
  }

  getFvUnitName(fv: FormulaVariable): string {
    if (!fv.unit) return '';
    return fv.unit.name ? `${fv.unit.name} (${fv.unit.symbol})` : fv.unit.symbol || '';
  }

  formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Get the output unit for a calculated parameter */
  getFormulaParamUnit(param: Parameter): string {
    return param.unit ? (param.unit as any).symbol || '' : '';
  }

  submit(): void {
    if (!this.productName.trim()) { this.error = 'Product name is required'; return; }
    if (!this.selectedCategoryId) { this.error = 'Select a category'; return; }
    if (this.totalInputCount === 0) { this.error = 'No inputs found for this category'; return; }

    const numericInputs: Record<string, number> = {};

    for (const p of this.inputParameters) {
      const val = this.inputValues[p.key];
      if (val === '' || val == null) { this.error = `Value required for "${p.name}"`; return; }
      const n = parseFloat(val);
      if (isNaN(n)) { this.error = `"${p.name}" must be a number`; return; }
      numericInputs[p.key] = n;
    }

    for (const fv of this.formulaVariables) {
      const val = this.inputValues[fv.key];
      if (val === '' || val == null) { this.error = `Value required for "${this.formatLabel(fv.key)}"`; return; }
      const n = parseFloat(val);
      if (isNaN(n)) { this.error = `"${this.formatLabel(fv.key)}" must be a number`; return; }
      numericInputs[fv.key] = n;
    }

    this.submitting = true;
    this.error = '';
    this.lastResult = null;

    this.api.createProduct({ name: this.productName, categoryId: this.selectedCategoryId, inputs: numericInputs })
      .subscribe({
        next: (result) => {
          this.lastResult = result;
          this.success = `✓ "${result.product.name}" calculated!`;
          this.submitting = false;
          this.loadProducts();
          setTimeout(() => (this.success = ''), 5000);
        },
        error: (err) => {
          this.error = err.error?.message || 'Calculation failed';
          this.submitting = false;
        },
      });
  }

  getEntries(obj: Record<string, number>): { key: string; value: number }[] {
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  }

  fmt(n: number): string {
    if (n == null) return '—';
    if (Number.isInteger(n)) return n.toLocaleString();
    return parseFloat(n.toFixed(6)).toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  /** Find the unit symbol for a calculated key from formulaParameters */
  getCalcUnit(key: string): string {
    const p = this.formulaParameters.find(fp => fp.key === key);
    return p ? this.getFormulaParamUnit(p) : '';
  }

  deleteProduct(id: string, name: string): void {
    if (!confirm(`Delete "${name}"?`)) return;
    this.api.deleteProduct(id).subscribe({
      next: () => { this.success = 'Deleted'; this.loadProducts(); setTimeout(() => (this.success = ''), 3000); },
      error: (e) => (this.error = e.error?.message || 'Failed'),
    });
  }

  reset(): void {
    this.productName = '';
    this.selectedCategoryId = '';
    this.resetInputs();
    this.lastResult = null;
    this.error = '';
  }
}
