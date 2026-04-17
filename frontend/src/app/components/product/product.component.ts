import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Category, Product, EngineResult, Parameter } from '../../models/interfaces';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatSnackBarModule,
    MatSelectModule,
    MatDividerModule,
    NgxMatSelectSearchModule
  ],
  templateUrl: './product.component.html',
  styleUrl: './product.component.css',
})
export class ProductComponent implements OnInit {
  // ── Existing products list ───────────────────────────────────────────────
  dataSource = new MatTableDataSource<Product>([]);
  displayedColumns: string[] = ['name', 'category', 'createdAt', 'actions'];

  @ViewChild(MatPaginator) set matPaginator(mp: MatPaginator) {
    this.dataSource.paginator = mp;
  }
  @ViewChild(MatSort) set matSort(ms: MatSort) {
    this.dataSource.sort = ms;
  }

  loadingProducts = false;

  // ── Form state ─────────────────────────────────────────────────────────
  categories: Category[] = [];
  filteredCategories: Category[] = [];
  catSearch = '';
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

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadProducts();
    this.api.getCategories().subscribe((cats) => {
      this.categories = cats;
      this.filterCategories();
    });
  }

  filterCategories(): void {
    if (!this.catSearch) { this.filteredCategories = [...this.categories]; return; }
    const s = this.catSearch.toLowerCase();
    this.filteredCategories = this.categories.filter(c => c.name.toLowerCase().includes(s));
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  loadProducts(): void {
    this.loadingProducts = true;
    this.api.getProducts().subscribe({
      next: (data) => {
        this.dataSource.data = data;
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
        this.snackBar.open(err.error?.message || 'Failed to load parameters for category', 'Close', { duration: 3000 });
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
      this.snackBar.open('Product name is required', 'Close', { duration: 3000 });
      return;
    }
    if (!this.selectedCategoryId) {
      this.snackBar.open('Please select a category', 'Close', { duration: 3000 });
      return;
    }

    // Convert string values to numbers and validate
    const numericInputs: Record<string, number> = {};
    for (const v of this.inputVariables) {
      const val = this.inputValues[v];
      if (val === '' || val === null || val === undefined) {
        this.snackBar.open(`Please provide a value for "${this.getInputLabel(v)}"`, 'Close', { duration: 3000 });
        return;
      }
      const num = parseFloat(val);
      if (isNaN(num)) {
        this.snackBar.open(`"${this.getInputLabel(v)}" must be a valid number`, 'Close', { duration: 3000 });
        return;
      }
      numericInputs[v] = num;
    }

    this.submitting = true;
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
          this.snackBar.open(`✓ "${result.product.name}" calculated successfully!`, 'Close', { duration: 5000 });
          this.submitting = false;
          this.loadProducts();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Calculation failed', 'Close', { duration: 3000 });
          this.submitting = false;
        },
      });
  }

  getGroupedResults(): { header: string; parameters: { name: string; key: string; value: number; unit: string }[] }[] {
    if (!this.lastResult || !this.lastResult.product.calculated) return [];

    const calculated = this.lastResult.product.calculated;
    const groups: Record<string, { header: string; parameters: { name: string; key: string; value: number; unit: string }[] }> = {};

    // Use categoryParameters or create a map for lookup
    const paramMap: Record<string, Parameter> = {};
    this.categoryParameters.forEach(p => paramMap[p.key] = p);

    Object.entries(calculated).forEach(([key, value]) => {
      const p = paramMap[key];
      const headerObj = (p?.headerInfoId as any);
      const headerName = headerObj?.name || 'Other Calculations';
      const headerId = headerObj?._id || 'other';

      if (!groups[headerId]) {
        groups[headerId] = { header: headerName, parameters: [] };
      }
      
      groups[headerId].parameters.push({
        name: p?.name || key,
        key: key,
        value: value,
        unit: (p?.unit as any)?.symbol || ''
      });
    });

    return Object.values(groups);
  }

  getGroupedInputs(): { header: string; parameters: Parameter[] }[] {
    const groups: Record<string, { header: string; parameters: Parameter[] }> = {};

    // Map input keys to their full parameter objects
    const inputParams = this.categoryParameters.filter(p => this.inputVariables.includes(p.key));

    inputParams.forEach(p => {
      const headerObj = (p.headerInfoId as any);
      const headerName = headerObj?.name || 'Other Inputs';
      const headerId = headerObj?._id || 'other';

      if (!groups[headerId]) {
        groups[headerId] = { header: headerName, parameters: [] };
      }
      groups[headerId].parameters.push(p);
    });

    return Object.values(groups);
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
        this.snackBar.open('Product deleted', 'Close', { duration: 3000 });
        this.loadProducts();
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to delete', 'Close', { duration: 3000 });
      },
    });
  }

  editProduct(product: Product): void {
    this.productName = product.name;
    this.selectedCategoryId = (product.categoryId as any)._id || product.categoryId;
    
    this.loadingInputs = true;
    this.error = '';
    this.lastResult = null;
    this.inputValues = {};

    // Fetch the inputs (now loads global inputs)
    this.api.getInputVariables(this.selectedCategoryId).subscribe({
      next: (result) => {
        this.inputVariables = result.inputVariables;
        this.categoryParameters = result.parameters;
        
        // Populate inputs with existing product data or empty string
        const init: Record<string, string> = {};
        for (const v of result.inputVariables) {
          if (product.inputs && product.inputs[v] !== undefined) {
            init[v] = product.inputs[v].toString();
          } else {
            init[v] = '';
          }
        }
        this.inputValues = init;
        this.loadingInputs = false;
        
        // Scroll to form smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to load parameters', 'Close', { duration: 3000 });
        this.loadingInputs = false;
      },
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
