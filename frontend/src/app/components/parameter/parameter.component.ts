import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Parameter, Category, Unit, HeaderInfo } from '../../models/interfaces';
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
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';

@Component({
  selector: 'app-parameter',
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
    MatRadioModule,
    MatTooltipModule,
    MatMenuModule,
    NgxMatSelectSearchModule
  ],
  templateUrl: './parameter.component.html',
  styleUrl: './parameter.component.css',
})
export class ParameterComponent implements OnInit {
  dataSource = new MatTableDataSource<Parameter>([]);
  displayedColumns: string[] = ['name', 'key', 'type', 'formula', 'unit', 'headerInfoId', 'categoryId', 'actions'];

  @ViewChild(MatPaginator) set matPaginator(mp: MatPaginator) {
    this.dataSource.paginator = mp;
  }
  @ViewChild(MatSort) set matSort(ms: MatSort) {
    this.dataSource.sort = ms;
  }

  categories: Category[] = [];
  units: Unit[] = [];
  headerInfos: HeaderInfo[] = [];

  // Filtered lists for searchable selects
  filteredCategories: Category[] = [];
  filteredUnits: Unit[] = [];
  filteredHeaderInfos: HeaderInfo[] = [];

  catSearch = '';
  unitSearch = '';
  headerSearch = '';

  tableFilterText = '';
  tableFilterCategory = '';
  tableFilterHeader = '';
  tableFilterType = '';

  loading = false;
  formVisible = false;
  editMode = false;
  saving = false;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  form: {
    name: string;
    key: string;
    type: 'input' | 'formula';
    formula: string;
    unitId: string;
    headerInfoId: string;
    categoryId: string;
  } = {
    name: '',
    key: '',
    type: 'formula',
    formula: '',
    unitId: '',
    headerInfoId: '',
    categoryId: '',
  };
  editId = '';

  // Live formula validation state
  formulaValid: boolean | null = null;
  formulaError = '';
  extractedVars: string[] = [];
  validatingFormula = false;
  menuSearchVar = '';

  private formulaInput$ = new Subject<string>();

  ngOnInit(): void {
    this.dataSource.filterPredicate = (data: Parameter, filterRaw: string) => {
      try {
        const filter = JSON.parse(filterRaw);
        
        let matchText = true;
        let matchCat = true;
        let matchHeader = true;

        if (filter.text) {
          const searchStr = `${data.name} ${data.key} ${data.formula}`.toLowerCase();
          matchText = searchStr.includes(filter.text.toLowerCase());
        }

        if (filter.categoryId) {
          const catId = (data.categoryId as any)?._id || data.categoryId;
          matchCat = catId === filter.categoryId;
        }

        if (filter.headerInfoId) {
          const headId = (data.headerInfoId as any)?._id || data.headerInfoId;
          matchHeader = headId === filter.headerInfoId;
        }

        let matchType = true;
        if (filter.type) {
          matchType = data.type === filter.type;
        }

        return matchText && matchCat && matchHeader && matchType;
      } catch (e) {
        // Fallback for direct string (if any)
        const searchStr = `${data.name} ${data.key} ${data.formula}`.toLowerCase();
        return searchStr.includes(filterRaw.toLowerCase());
      }
    };

    this.load();
    this.loadMeta();
    this.setupFormulaValidation();
  }

  load(): void {
    this.loading = true;
    this.api.getParameters().subscribe({
      next: (data) => {
        this.dataSource.data = data;
        this.loading = false;
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to load parameters', 'Close', { duration: 3000 });
        this.loading = false;
      },
    });
  }

  applyFilter(): void {
    const filterObj = {
      text: this.tableFilterText.trim(),
      categoryId: this.tableFilterCategory,
      headerInfoId: this.tableFilterHeader,
      type: this.tableFilterType
    };
    
    this.dataSource.filter = JSON.stringify(filterObj);

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  loadMeta(): void {
    this.api.getCategories().subscribe((cats) => { this.categories = cats; this.filterCategories(); });
    this.api.getUnits().subscribe((units) => { this.units = units; this.filterUnits(); });
    this.api.getHeaderInfos().subscribe((infos) => { this.headerInfos = infos; this.filterHeaderInfos(); });
  }

  filterCategories(): void {
    if (!this.catSearch) { this.filteredCategories = [...this.categories]; return; }
    const s = this.catSearch.toLowerCase();
    this.filteredCategories = this.categories.filter(c => c.name.toLowerCase().includes(s));
  }

  filterUnits(): void {
    if (!this.unitSearch) { this.filteredUnits = [...this.units]; return; }
    const s = this.unitSearch.toLowerCase();
    this.filteredUnits = this.units.filter(u => u.name.toLowerCase().includes(s) || u.symbol.toLowerCase().includes(s));
  }

  filterHeaderInfos(): void {
    if (!this.headerSearch) { this.filteredHeaderInfos = [...this.headerInfos]; return; }
    const s = this.headerSearch.toLowerCase();
    this.filteredHeaderInfos = this.headerInfos.filter(h => h.name.toLowerCase().includes(s));
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

  getAvailableParametersForFormula(): Parameter[] {
    const catId = this.form.categoryId;
    return this.dataSource.data.filter(p => {
      // Don't allow inserting itself
      if (this.editId && p._id === this.editId) return false;
      
      const pCat = (p.categoryId as any)?._id || p.categoryId;
      // Include global parameters (no category) AND parameters in the selected category
      return !pCat || pCat === catId;
    });
  }

  getFilteredAvailableParameters(): Parameter[] {
    const list = this.getAvailableParametersForFormula();
    if (!this.menuSearchVar) return list;
    const search = this.menuSearchVar.toLowerCase();
    return list.filter(p => 
      p.key.toLowerCase().includes(search) || 
      p.name.toLowerCase().includes(search)
    );
  }

  insertVariable(key: string, inputElement: HTMLInputElement): void {
    const start = inputElement.selectionStart || 0;
    const end = inputElement.selectionEnd || 0;
    const current = this.form.formula || '';
    
    const insertStr = ` ${key} `;
    this.form.formula = current.substring(0, start) + insertStr + current.substring(end);
    
    // Wait for angular to update DOM then refocus and position cursor
    setTimeout(() => {
      inputElement.focus();
      inputElement.setSelectionRange(start + insertStr.length, start + insertStr.length);
    }, 0);
    
    // Trigger validation
    this.onFormulaChange(this.form.formula);
  }

  openCreate(): void {
    this.editMode = false;
    this.editId = '';
    this.form = { name: '', key: '', type: 'formula', formula: '', unitId: '', headerInfoId: '', categoryId: '' };
    this.formulaValid = null;
    this.extractedVars = [];
    this.formulaError = '';
    this.formVisible = true;
  }

  openEdit(param: Parameter): void {
    this.editMode = true;
    this.editId = param._id;
    this.form = {
      name: param.name,
      key: param.key,
      type: param.type || 'formula',
      formula: param.formula,
      unitId: (param.unit as any)?._id || '',
      headerInfoId: (param.headerInfoId as any)?._id || '',
      categoryId: (param.categoryId as any)?._id || '',
    };
    this.formulaValid = null;
    this.extractedVars = [];
    this.formulaError = '';
    this.formVisible = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Trigger validation for the existing formula
    this.onFormulaChange(param.formula);
  }

  closeForm(): void {
    this.formVisible = false;
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.key.trim()) {
      this.snackBar.open('Name and Key are required', 'Close', { duration: 3000 });
      return;
    }
    if (this.form.type === 'formula') {
      if (!this.form.formula.trim()) {
        this.snackBar.open('Formula is required for Calculated Parameters', 'Close', { duration: 3000 });
        return;
      }
      if (this.formulaValid === false) {
        this.snackBar.open('Please fix the formula error before saving', 'Close', { duration: 3000 });
        return;
      }
    }
    
    this.saving = true;

    const payload: any = {
      name: this.form.name,
      key: this.form.key,
      type: this.form.type,
      formula: this.form.type === 'formula' ? this.form.formula : '',
      unit: this.form.unitId || null,
      headerInfoId: this.form.headerInfoId || null,
      categoryId: this.form.categoryId || null,
    };

    const req = this.editMode
      ? this.api.updateParameter(this.editId, payload)
      : this.api.createParameter(payload);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(this.editMode ? 'Parameter updated!' : 'Parameter created!', 'Close', { duration: 3000 });
        this.formVisible = false;
        this.load();
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to save', 'Close', { duration: 3000 });
        this.saving = false;
      },
    });
  }

  delete(id: string, name: string): void {
    if (!confirm(`Delete parameter "${name}"?`)) return;
    this.api.deleteParameter(id).subscribe({
      next: () => {
        this.snackBar.open('Parameter deleted', 'Close', { duration: 3000 });
        this.load();
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to delete', 'Close', { duration: 3000 });
      },
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

  getHeaderInfoName(param: Parameter): string {
    if (!param.headerInfoId) return '—';
    return (param.headerInfoId as any).name || '—';
  }
}
