import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Parameter, Category, Unit, FormulaValidationResult } from '../../models/interfaces';

@Component({
  selector: 'app-parameter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parameter.component.html',
  styleUrl: './parameter.component.css',
})
export class ParameterComponent implements OnInit {
  parameters: Parameter[] = [];
  categories: Category[] = [];
  units: Unit[] = [];

  loading = false;
  formVisible = false;
  editMode = false;
  saving = false;
  error = '';
  success = '';

  form = {
    name: '',
    key: '',
    isInput: false,
    formula: '',
    unitId: '',     // unit for the output of this parameter
    categoryId: '',
    /** Maps raw variable name → unit _id (empty string = no unit) */
    variableUnits: {} as Record<string, string>,
  };
  editId = '';

  // Formula validation + classified variables
  formulaValid: boolean | null = null;
  formulaError = '';
  validatingFormula = false;
  inputParamVars: string[] = [];
  formulaParamVars: string[] = [];
  unknownVars: string[] = [];
  allVars: string[] = [];

  private formulaInput$ = new Subject<string>();

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
    this.loadMeta();
    this.setupFormulaValidation();
  }

  load(): void {
    this.loading = true;
    this.api.getParameters().subscribe({
      next: (d) => { this.parameters = d; this.loading = false; },
      error: (e) => { this.error = e.error?.message || 'Failed to load'; this.loading = false; },
    });
  }

  loadMeta(): void {
    this.api.getCategories().subscribe((c) => (this.categories = c));
    this.api.getUnits().subscribe((u) => (this.units = u));
  }

  setupFormulaValidation(): void {
    this.formulaInput$
      .pipe(
        debounceTime(450),
        distinctUntilChanged(),
        switchMap((formula) => {
          this.validatingFormula = true;
          this.formulaValid = null;
          this.clearVars();
          return this.api.validateFormula(
            formula,
            this.form.categoryId || undefined,
            this.editMode ? this.form.key : undefined,
          );
        })
      )
      .subscribe({
        next: (r: FormulaValidationResult) => {
          this.formulaValid = r.valid;
          this.formulaError = r.error || '';
          this.allVars         = r.variables       || [];
          this.inputParamVars  = r.inputParamVars  || [];
          this.formulaParamVars = r.formulaParamVars || [];
          this.unknownVars     = r.unknownVars     || this.allVars;
          this.validatingFormula = false;

          // Sync variableUnits: keep entries only for current unknownVars
          const updated: Record<string, string> = {};
          for (const v of this.unknownVars) {
            updated[v] = this.form.variableUnits[v] || '';
          }
          this.form.variableUnits = updated;
        },
        error: (e) => {
          this.formulaValid = false;
          this.formulaError = e.error?.error || 'Validation failed';
          this.validatingFormula = false;
        },
      });
  }

  clearVars(): void {
    this.allVars = [];
    this.inputParamVars = [];
    this.formulaParamVars = [];
    this.unknownVars = [];
  }

  onFormulaChange(value: string): void {
    if (value.trim().length > 0) {
      this.formulaInput$.next(value.trim());
    } else {
      this.formulaValid = null;
      this.clearVars();
      this.form.variableUnits = {};
    }
  }

  onCategoryChange(): void {
    if (!this.form.isInput && this.form.formula.trim()) {
      this.formulaInput$.next(this.form.formula.trim());
    }
  }

  onIsInputChange(): void {
    this.formulaValid = null;
    this.clearVars();
    this.form.variableUnits = {};
    if (this.form.isInput) this.form.formula = '';
  }

  openCreate(): void {
    this.editMode = false;
    this.editId = '';
    this.form = { name: '', key: '', isInput: false, formula: '', unitId: '', categoryId: '', variableUnits: {} };
    this.formulaValid = null;
    this.clearVars();
    this.error = '';
    this.success = '';
    this.formVisible = true;
  }

  openEdit(param: Parameter): void {
    this.editMode = true;
    this.editId = param._id;

    // Reconstruct variableUnits from the populated response
    const varUnits: Record<string, string> = {};
    if (param._populatedVariableUnits) {
      for (const [v, unit] of Object.entries(param._populatedVariableUnits)) {
        varUnits[v] = unit ? (unit as any)._id || '' : '';
      }
    } else if ((param as any).variableUnits) {
      // raw map from mongoose
      const raw = (param as any).variableUnits;
      if (raw instanceof Map) {
        for (const [k, v] of raw.entries()) varUnits[k] = v || '';
      } else {
        Object.assign(varUnits, raw);
      }
    }

    this.form = {
      name: param.name,
      key: param.key,
      isInput: param.isInput,
      formula: param.formula || '',
      unitId: (param.unit as any)?._id || '',
      categoryId: (param.categoryId as any)?._id || '',
      variableUnits: varUnits,
    };
    this.formulaValid = null;
    this.clearVars();
    this.error = '';
    this.success = '';
    this.formVisible = true;
    if (!param.isInput && param.formula) this.onFormulaChange(param.formula);
  }

  closeForm(): void {
    this.formVisible = false;
    this.error = '';
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.key.trim()) {
      this.error = 'Name and Key are required';
      return;
    }
    if (!this.form.isInput && !this.form.formula.trim()) {
      this.error = 'Formula is required for calculated parameters';
      return;
    }
    if (!this.form.isInput && this.formulaValid === false) {
      this.error = 'Fix the formula error before saving';
      return;
    }
    this.saving = true;
    this.error = '';

    // Build variableUnits — only include entries with a non-empty unit
    const variableUnits: Record<string, string | null> = {};
    if (!this.form.isInput) {
      for (const [varName, unitId] of Object.entries(this.form.variableUnits)) {
        variableUnits[varName] = unitId || null;
      }
    }

    const payload: any = {
      name: this.form.name,
      key: this.form.key,
      isInput: this.form.isInput,
      formula: this.form.isInput ? '' : this.form.formula,
      unit: this.form.unitId || null,
      categoryId: this.form.categoryId || null,
      variableUnits,
    };

    const req$ = this.editMode
      ? this.api.updateParameter(this.editId, payload)
      : this.api.createParameter(payload);

    req$.subscribe({
      next: () => {
        this.saving = false;
        this.success = this.editMode ? 'Parameter updated!' : 'Parameter created!';
        this.formVisible = false;
        this.load();
        setTimeout(() => (this.success = ''), 3000);
      },
      error: (e) => {
        this.error = e.error?.message || 'Failed to save';
        this.saving = false;
      },
    });
  }

  delete(id: string, name: string): void {
    if (!confirm(`Delete parameter "${name}"?`)) return;
    this.api.deleteParameter(id).subscribe({
      next: () => { this.success = 'Deleted'; this.load(); setTimeout(() => (this.success = ''), 3000); },
      error: (e) => (this.error = e.error?.message || 'Failed to delete'),
    });
  }

  getCategoryName(p: Parameter): string {
    return p.categoryId ? (p.categoryId as any).name : '—';
  }

  getUnitSymbol(p: Parameter): string {
    return p.unit ? (p.unit as any).symbol || '' : '';
  }

  /** Get unit name for a given unit id from the loaded units list */
  getUnitNameById(id: string): string {
    if (!id) return '—';
    const u = this.units.find(u => u._id === id);
    return u ? `${u.name} (${u.symbol})` : id;
  }

  /** Get the display symbol for a variable unit id */
  getVarUnitSymbol(unitId: string): string {
    if (!unitId) return '';
    const u = this.units.find(u => u._id === unitId);
    return u ? u.symbol : '';
  }

  get hasClassifiedVars(): boolean {
    return this.inputParamVars.length > 0 || this.formulaParamVars.length > 0 || this.unknownVars.length > 0;
  }
}
