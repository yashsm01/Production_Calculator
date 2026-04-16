import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Parameter, Category, Unit } from '../../models/interfaces';

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
    formula: '',
    unitId: '',
    categoryId: '',
  };
  editId = '';

  // Live formula validation state
  formulaValid: boolean | null = null;
  formulaError = '';
  extractedVars: string[] = [];
  validatingFormula = false;

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
      next: (data) => {
        this.parameters = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load parameters';
        this.loading = false;
      },
    });
  }

  loadMeta(): void {
    this.api.getCategories().subscribe((cats) => (this.categories = cats));
    this.api.getUnits().subscribe((units) => (this.units = units));
  }

  setupFormulaValidation(): void {
    this.formulaInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((formula) => {
          this.validatingFormula = true;
          this.formulaValid = null;
          this.extractedVars = [];
          return this.api.validateFormula(formula);
        })
      )
      .subscribe({
        next: (result) => {
          this.formulaValid = result.valid;
          this.formulaError = result.error || '';
          this.extractedVars = result.variables || [];
          this.validatingFormula = false;
        },
        error: (err) => {
          this.formulaValid = false;
          this.formulaError = err.error?.error || 'Validation failed';
          this.validatingFormula = false;
        },
      });
  }

  onFormulaChange(value: string): void {
    if (value.trim().length > 0) {
      this.formulaInput$.next(value.trim());
    } else {
      this.formulaValid = null;
      this.extractedVars = [];
    }
  }

  openCreate(): void {
    this.editMode = false;
    this.editId = '';
    this.form = { name: '', key: '', formula: '', unitId: '', categoryId: '' };
    this.formulaValid = null;
    this.extractedVars = [];
    this.formulaError = '';
    this.error = '';
    this.success = '';
    this.formVisible = true;
  }

  openEdit(param: Parameter): void {
    this.editMode = true;
    this.editId = param._id;
    this.form = {
      name: param.name,
      key: param.key,
      formula: param.formula,
      unitId: (param.unit as any)?._id || '',
      categoryId: (param.categoryId as any)?._id || '',
    };
    this.formulaValid = null;
    this.extractedVars = [];
    this.formulaError = '';
    this.error = '';
    this.success = '';
    this.formVisible = true;
    // Trigger validation for the existing formula
    this.onFormulaChange(param.formula);
  }

  closeForm(): void {
    this.formVisible = false;
    this.error = '';
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.key.trim() || !this.form.formula.trim()) {
      this.error = 'Name, Key, and Formula are required';
      return;
    }
    if (this.formulaValid === false) {
      this.error = 'Please fix the formula error before saving';
      return;
    }
    this.saving = true;
    this.error = '';

    const payload: any = {
      name: this.form.name,
      key: this.form.key,
      formula: this.form.formula,
      unit: this.form.unitId || null,
      categoryId: this.form.categoryId || null,
    };

    const req = this.editMode
      ? this.api.updateParameter(this.editId, payload)
      : this.api.createParameter(payload);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.success = this.editMode ? 'Parameter updated!' : 'Parameter created!';
        this.formVisible = false;
        this.load();
        setTimeout(() => (this.success = ''), 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to save';
        this.saving = false;
      },
    });
  }

  delete(id: string, name: string): void {
    if (!confirm(`Delete parameter "${name}"?`)) return;
    this.api.deleteParameter(id).subscribe({
      next: () => {
        this.success = 'Parameter deleted';
        this.load();
        setTimeout(() => (this.success = ''), 3000);
      },
      error: (err) => (this.error = err.error?.message || 'Failed to delete'),
    });
  }

  getCategoryName(param: Parameter): string {
    if (!param.categoryId) return '—';
    return (param.categoryId as any).name || '—';
  }

  getUnitSymbol(param: Parameter): string {
    if (!param.unit) return '—';
    return (param.unit as any).symbol || '—';
  }
}
