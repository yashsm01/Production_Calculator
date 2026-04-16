import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Category, Product, EngineResult, Parameter } from '../../models/interfaces';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product.component.html',
  styleUrl: './product.component.css',
})
export class ProductComponent implements OnInit {
  // ── Existing products list ───────────────────────────────────────────────
  products: Product[] = [];
  loadingProducts = false;

  // ── Form state ─────────────────────────────────────────────────────────
  categories: Category[] = [];
  selectedCategoryId = '';
  productName = '';

  // Dynamic inputs: variable name → value (number)
  inputVariables: string[] = [];
  inputValues: Record<string, string> = {};

  // Parameters for the selected category (for dependency visualization)
  categoryParameters: Parameter[] = [];

  // UI state
  loadingInputs = false;
  submitting = false;
  error = '';
  success = '';

  // Last calculation result
  lastResult: EngineResult | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadProducts();
    this.api.getCategories().subscribe((cats) => (this.categories = cats));
  }

  loadProducts(): void {
    this.loadingProducts = true;
    this.api.getProducts().subscribe({
      next: (data) => {
        this.products = data;
        this.loadingProducts = false;
      },
      error: () => (this.loadingProducts = false),
    });
  }

  onCategoryChange(): void {
    if (!this.selectedCategoryId) {
      this.inputVariables = [];
      this.inputValues = {};
      this.categoryParameters = [];
      return;
    }

    this.loadingInputs = true;
    this.error = '';
    this.lastResult = null;
    this.inputValues = {};

    this.api.getInputVariables(this.selectedCategoryId).subscribe({
      next: (result) => {
        this.inputVariables = result.inputVariables;
        this.categoryParameters = result.parameters;
        // Initialize all inputs to empty
        const init: Record<string, string> = {};
        for (const v of result.inputVariables) {
          init[v] = '';
        }
        this.inputValues = init;
        this.loadingInputs = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load parameters for category';
        this.loadingInputs = false;
      },
    });
  }

  getInputLabel(varName: string): string {
    // Format snake_case to Title Case
    return varName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  submit(): void {
    if (!this.productName.trim()) {
      this.error = 'Product name is required';
      return;
    }
    if (!this.selectedCategoryId) {
      this.error = 'Please select a category';
      return;
    }

    // Convert string values to numbers and validate
    const numericInputs: Record<string, number> = {};
    for (const v of this.inputVariables) {
      const val = this.inputValues[v];
      if (val === '' || val === null || val === undefined) {
        this.error = `Please provide a value for "${this.getInputLabel(v)}"`;
        return;
      }
      const num = parseFloat(val);
      if (isNaN(num)) {
        this.error = `"${this.getInputLabel(v)}" must be a valid number`;
        return;
      }
      numericInputs[v] = num;
    }

    this.submitting = true;
    this.error = '';
    this.lastResult = null;

    this.api
      .createProduct({
        name: this.productName,
        categoryId: this.selectedCategoryId,
        inputs: numericInputs,
      })
      .subscribe({
        next: (result) => {
          this.lastResult = result;
          this.success = `✓ "${result.product.name}" calculated successfully!`;
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

  getCalculatedEntries(calculated: Record<string, number>): { key: string; value: number }[] {
    return Object.entries(calculated).map(([key, value]) => ({ key, value }));
  }

  getInputEntries(inputs: Record<string, number>): { key: string; value: number }[] {
    return Object.entries(inputs).map(([key, value]) => ({ key, value }));
  }

  formatNumber(n: number): string {
    if (n === undefined || n === null) return '—';
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  deleteProduct(id: string, name: string): void {
    if (!confirm(`Delete product "${name}"?`)) return;
    this.api.deleteProduct(id).subscribe({
      next: () => {
        this.success = 'Product deleted';
        this.loadProducts();
        setTimeout(() => (this.success = ''), 3000);
      },
      error: (err) => (this.error = err.error?.message || 'Failed to delete'),
    });
  }

  resetForm(): void {
    this.productName = '';
    this.selectedCategoryId = '';
    this.inputVariables = [];
    this.inputValues = {};
    this.categoryParameters = [];
    this.lastResult = null;
    this.error = '';
  }
}
