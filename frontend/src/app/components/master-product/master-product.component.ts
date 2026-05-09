import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../services/api.service';
import { Product, MasterProduct, MasterParam, MasterProductRef, MasterRefDetail } from '../../models/interfaces';

@Component({
  selector: 'app-master-product',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDividerModule, MatSnackBarModule, MatTooltipModule,
    MatChipsModule, MatTableModule, MatExpansionModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './master-product.component.html',
  styleUrl: './master-product.component.css',
})
export class MasterProductComponent implements OnInit {

  // ── Data ────────────────────────────────────────────────────────────────────
  allProducts: Product[] = [];
  masterProducts: MasterProduct[] = [];

  // ── Form State ──────────────────────────────────────────────────────────────
  formVisible = false;
  editMode = false;
  editId: string | null = null;
  saving = false;

  form = {
    name: '',
    description: '',
  };

  // Product references (alias → product)
  productRefs: { productId: string; alias: string }[] = [];

  // Master parameters
  masterParams: MasterParam[] = [];

  // ── Preview / Result State ──────────────────────────────────────────────────
  previewLoading = false;
  previewDone = false;
  refDetails: MasterRefDetail[] = [];
  scope: Record<string, number> = {};
  computed: Record<string, number> = {};

  // ── Selected master for report view ────────────────────────────────────────
  viewingMaster: MasterProduct | null = null;
  viewRefDetails: MasterRefDetail[] = [];
  viewScope: Record<string, number> = {};
  viewLoading = false;

  loading = true;

  constructor(private api: ApiService, private snack: MatSnackBar) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.api.getProducts().subscribe({
      next: (prods) => { this.allProducts = prods; this.loadMasters(); },
      error: () => { this.snack.open('Failed to load products', 'Close', { duration: 3000 }); this.loading = false; }
    });
  }

  loadMasters(): void {
    this.api.getMasterProducts().subscribe({
      next: (ms) => { this.masterProducts = ms; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  // ── Form Helpers ─────────────────────────────────────────────────────────────
  openCreate(): void {
    this.formVisible = true;
    this.editMode = false;
    this.editId = null;
    this.form = { name: '', description: '' };
    this.productRefs = [];
    this.masterParams = [];
    this.previewDone = false;
    this.refDetails = [];
    this.scope = {};
    this.computed = {};
  }

  openEdit(master: MasterProduct): void {
    this.formVisible = true;
    this.editMode = true;
    this.editId = master._id!;
    this.form = { name: master.name, description: master.description || '' };
    this.productRefs = (master.productRefs || []).map(r => ({
      productId: typeof r.productId === 'string' ? r.productId : (r.productId as any)._id,
      alias: r.alias,
    }));
    this.masterParams = JSON.parse(JSON.stringify(master.masterParams || []));
    this.previewDone = false;
    this.refDetails = [];
    this.scope = {};
    this.computed = {};
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm(): void {
    this.formVisible = false;
    this.previewDone = false;
  }

  addProductRef(): void {
    this.productRefs.push({ productId: '', alias: '' });
    this.previewDone = false;
  }

  removeProductRef(idx: number): void {
    this.productRefs.splice(idx, 1);
    this.previewDone = false;
  }

  addMasterParam(): void {
    this.masterParams.push({ key: '', name: '', formula: '', unit: '', index: this.masterParams.length });
    this.previewDone = false;
  }

  removeMasterParam(idx: number): void {
    this.masterParams.splice(idx, 1);
  }

  // ── Preview ──────────────────────────────────────────────────────────────────
  preview(): void {
    if (!this.productRefs.some(r => r.productId && r.alias)) {
      this.snack.open('Add at least one product reference with an alias', 'Close', { duration: 3000 });
      return;
    }
    this.previewLoading = true;
    this.previewDone = false;
    this.api.previewMasterProduct({ productRefs: this.productRefs, masterParams: this.masterParams }).subscribe({
      next: (res) => {
        this.refDetails = res.refDetails || [];
        this.scope = res.scope || {};
        this.computed = (res as any).computed || {};
        this.previewLoading = false;
        this.previewDone = true;
      },
      error: (err) => {
        this.snack.open(err?.error?.message || 'Preview failed', 'Close', { duration: 4000 });
        this.previewLoading = false;
      }
    });
  }

  insertAliasKey(paramIdx: number, scopeKey: string): void {
    const current = this.masterParams[paramIdx].formula || '';
    this.masterParams[paramIdx].formula = current ? current + ' + ' + scopeKey : scopeKey;
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  save(): void {
    if (!this.form.name.trim()) {
      this.snack.open('Master product name is required', 'Close', { duration: 3000 }); return;
    }
    if (!this.productRefs.some(r => r.productId && r.alias)) {
      this.snack.open('Add at least one product reference', 'Close', { duration: 3000 }); return;
    }

    this.saving = true;
    const payload: Partial<MasterProduct> = {
      name: this.form.name.trim(),
      description: this.form.description.trim(),
      productRefs: this.productRefs,
      masterParams: this.masterParams,
    };

    const request = this.editMode && this.editId
      ? this.api.updateMasterProduct(this.editId, payload)
      : this.api.createMasterProduct(payload);

    request.subscribe({
      next: (res) => {
        this.saving = false;
        this.snack.open(`Master product "${res.master.name}" saved!`, 'Close', { duration: 3000 });
        this.closeForm();
        this.loadMasters();
      },
      error: (err) => {
        this.saving = false;
        this.snack.open(err?.error?.message || 'Save failed', 'Close', { duration: 4000 });
      }
    });
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  delete(id: string, name: string): void {
    if (!confirm(`Delete master product "${name}"?`)) return;
    this.api.deleteMasterProduct(id).subscribe({
      next: () => {
        this.snack.open('Deleted', 'Close', { duration: 2000 });
        this.masterProducts = this.masterProducts.filter(m => m._id !== id);
        if (this.viewingMaster?._id === id) this.viewingMaster = null;
      },
      error: () => this.snack.open('Delete failed', 'Close', { duration: 3000 })
    });
  }

  // ── View / Report ─────────────────────────────────────────────────────────
  viewMaster(master: MasterProduct): void {
    this.viewLoading = true;
    this.viewingMaster = null;
    this.api.getMasterProductById(master._id!).subscribe({
      next: (res) => {
        this.viewingMaster = res.master;
        this.viewRefDetails = res.refDetails || [];
        this.viewScope = res.scope || {};
        this.viewLoading = false;
        setTimeout(() => document.getElementById('master-report')?.scrollIntoView({ behavior: 'smooth' }), 100);
      },
      error: () => { this.viewLoading = false; this.snack.open('Failed to load master report', 'Close', { duration: 3000 }); }
    });
  }

  closeView(): void {
    this.viewingMaster = null;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  getProductName(id: string): string {
    const p = this.allProducts.find(p => p._id === id);
    return p ? `${p.name} (${p.categoryId?.name || ''})` : id;
  }

  getScopeKeysForRef(alias: string): string[] {
    const prefix = alias.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_';
    return Object.keys(this.scope).filter(k => k.startsWith(prefix));
  }

  getScopeKeysForViewRef(alias: string): string[] {
    const prefix = alias.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_';
    return Object.keys(this.viewScope).filter(k => k.startsWith(prefix));
  }

  getMasterParamKeys(): string[] {
    return this.viewingMaster?.masterParams?.map(p => p.key.toLowerCase()) || [];
  }

  getMasterComputedKeys(): string[] {
    return Object.keys(this.viewScope).filter(k => !k.includes('_') || this.getMasterParamKeys().includes(k));
  }

  formatNum(n: number): string {
    if (n === undefined || n === null) return '—';
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  getAliasColor(idx: number): string {
    const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];
    return colors[idx % colors.length];
  }
}
