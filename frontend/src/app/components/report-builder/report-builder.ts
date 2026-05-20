import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Category, Product, Parameter, ReportTemplate, ReportTemplateCell, MasterProduct, MasterRefDetail, Unit, HeaderInfo } from '../../models/interfaces';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatChipsModule } from '@angular/material/chips';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-report-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatButtonToggleModule,
    DragDropModule,
    MatDialogModule,
    MatChipsModule,
    NgxMatSelectSearchModule
  ],
  templateUrl: './report-builder.html',
  styleUrl: './report-builder.css',
})
export class ReportBuilder implements OnInit {
  // ── Source selection ─────────────────────────────────────────────────────
  sourceType: 'product' | 'master' = 'product';

  // ── Product source ───────────────────────────────────────────────────────
  products: Product[] = [];
  selectedProductId = '';
  parameters: Parameter[] = [];

  // ── Master source ────────────────────────────────────────────────────────
  masterProducts: MasterProduct[] = [];
  selectedMasterId = '';
  masterScope: Record<string, number> = {};
  masterRefDetails: MasterRefDetail[] = [];
  // Flat list of scope key items for the sidebar
  masterScopeItems: { key: string; name: string; group: string; value: number }[] = [];

  templates: ReportTemplate[] = [];
  selectedTemplateId = '';

  template: ReportTemplate = {
    rowCount: 10,
    colCount: 4,
    cells: [],
    colWidths: [],
    rowHeights: []
  };

  loading = false;
  saving = false;

  // Selected cell for editing
  selectedCells: { row: number, col: number }[] = [];
  selectedCell: { row: number, col: number } | null = null;
  cellEditType: 'text' | 'parameter' = 'text';
  cellEditContent = '';
  cellEditBold = false;
  cellEditAlign: 'left' | 'center' | 'right' = 'left';
  cellEditColSpan = 1;
  cellEditRowSpan = 1;
  cellEditThickBorder = false;
  cellEditBgColor = '';
  cellEditFontColor = '';

  // Copy/paste clipboard
  copiedCells: { rowOffset: number; colOffset: number; cell: ReportTemplateCell }[] = [];

  // Undo history
  undoStack: ReportTemplateCell[][] = [];
  lastInternalTsv = '';


  // Resize state
  resizingCol: number | null = null;
  resizingRow: number | null = null;
  resizeStartX = 0;
  resizeStartY = 0;
  resizeStartWidth = 0;
  resizeStartHeight = 0;

  // Zoom
  zoomLevel = 1;
  zoomIn()  { this.zoomLevel = Math.min(3, +(this.zoomLevel + 0.1).toFixed(1)); }
  zoomOut() { this.zoomLevel = Math.max(0.3, +(this.zoomLevel - 0.1).toFixed(1)); }
  zoomReset() { this.zoomLevel = 1; }

  // Sidebar search & filter
  sidebarSearch = '';
  sidebarGroupFilter = '';

  // Meta lists for creation dialog
  categories: Category[] = [];
  units: Unit[] = [];
  headerInfos: HeaderInfo[] = [];

  // Filtered lists for searchable selects in the dialog
  filteredCategories: Category[] = [];
  filteredUnits: Unit[] = [];
  filteredHeaderInfos: HeaderInfo[] = [];

  catSearch = '';
  unitSearch = '';
  headerSearch = '';

  // dialog parameter creation form state
  dialogParamForm = {
    name: '',
    key: '',
    type: 'formula' as 'input' | 'formula',
    formula: '',
    unitId: '',
    headerInfoId: '',
    categoryIds: [] as string[],
    index: null as number | null
  };

  savingDialogParam = false;
  dialogFormulaValid: boolean | null = null;
  dialogFormulaError = '';
  dialogExtractedVars: string[] = [];
  dialogValidatingFormula = false;

  private dialogFormulaInput$ = new Subject<string>();

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.api.getProducts().subscribe(prods => this.products = prods);
    this.api.getMasterProducts().subscribe(ms => this.masterProducts = ms);
    this.loadMetaForDialog();
    this.setupDialogFormulaValidation();
  }

  // ── Source type toggle ───────────────────────────────────────────────────
  onSourceTypeChange(): void {
    this.selectedProductId = '';
    this.selectedMasterId = '';
    this.parameters = [];
    this.masterScopeItems = [];
    this.masterScope = {};
    this.templates = [];
    this.selectedTemplateId = '';
    this.selectedCells = [];
    this.selectedCell = null;
    this.sidebarSearch = '';
    this.sidebarGroupFilter = '';
    this.template = { rowCount: 10, colCount: 4, cells: [], colWidths: [], rowHeights: [] };
  }

  onProductChange() {
    if (!this.selectedProductId) return;
    this.loading = true;
    this.parameters = [];
    this.selectedCells = [];
    this.selectedCell = null;
    this.undoStack = [];
    
    // Find selected product
    const product = this.products.find(p => p._id === this.selectedProductId);
    if (!product) return;
    
    // Get category ID from product to fetch parameters
    const catId = (product.categoryId as any)._id || product.categoryId as unknown as string;
    
    // Fetch parameters
    this.api.getInputVariables(catId).subscribe(res => {
      this.parameters = res.parameters;
      
      // Fetch existing templates for this product
      this.api.getReportTemplatesByProduct(this.selectedProductId).subscribe({
        next: (tpls) => {
          this.templates = tpls;
          this.loading = false;
        },
        error: (err) => {
          this.templates = [];
          this.loading = false;
        }
      });
    });
  }

  // ── Master Product source ─────────────────────────────────────────────────
  onMasterChange(): void {
    if (!this.selectedMasterId) return;
    this.loading = true;
    this.masterScopeItems = [];
    this.masterScope = {};
    this.selectedCells = [];
    this.selectedCell = null;
    this.undoStack = [];

    this.api.getMasterProductById(this.selectedMasterId).subscribe({
      next: (res) => {
        this.masterScope = res.scope || {};
        this.masterRefDetails = res.refDetails || [];
        this.masterScopeItems = this.buildMasterScopeItems(res);

        this.api.getReportTemplatesByMaster(this.selectedMasterId).subscribe({
          next: (tpls) => { this.templates = tpls; this.loading = false; },
          error: () => { this.templates = []; this.loading = false; }
        });
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load master product', 'Close', { duration: 3000 });
      }
    });
  }

  private buildMasterScopeItems(res: any): { key: string; name: string; group: string; value: number }[] {
    const items: { key: string; name: string; group: string; value: number }[] = [];
    const master: MasterProduct = res.master;

    // Add scoped values from each referenced product
    for (const detail of (res.refDetails || []) as MasterRefDetail[]) {
      const prefix = detail.alias.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_';
      for (const [key, value] of Object.entries(res.scope || {})) {
        if (key.startsWith(prefix)) {
          const originalKey = key.substring(prefix.length);
          items.push({
            key,
            name: `${originalKey}`,
            group: `${detail.alias} — ${detail.productName}`,
            value: value as number
          });
        }
      }
    }

    // Add master-level computed params
    for (const param of (master.masterParams || [])) {
      const k = param.key.toLowerCase();
      items.push({
        key: k,
        name: param.name,
        group: '★ Master Parameters',
        value: res.scope[k] ?? 0
      });
    }

    return items;
  }

  getMasterGroups(): string[] {
    return [...new Set(this.masterScopeItems.map(i => i.group))];
  }

  getMasterItemsForGroup(group: string): { key: string; name: string; group: string; value: number }[] {
    return this.masterScopeItems.filter(i => i.group === group);
  }

  // ── Sidebar search / filter helpers ─────────────────────────────────────────
  onSidebarSearchChange(): void {
    // triggers template re-render via getFiltered* methods
  }

  getFilteredMasterItems(): { key: string; name: string; group: string; value: number }[] {
    const q = this.sidebarSearch.toLowerCase().trim();
    const gf = this.sidebarGroupFilter;
    return this.masterScopeItems.filter(i => {
      const matchGroup = !gf || i.group === gf;
      const matchSearch = !q || i.key.includes(q) || i.name.toLowerCase().includes(q);
      return matchGroup && matchSearch;
    });
  }

  getFilteredMasterGroups(): string[] {
    return [...new Set(this.getFilteredMasterItems().map(i => i.group))];
  }

  getFilteredMasterItemsForGroup(group: string): { key: string; name: string; group: string; value: number }[] {
    return this.getFilteredMasterItems().filter(i => i.group === group);
  }

  getFilteredGroupedParameters() {
    const q = this.sidebarSearch.toLowerCase().trim();
    if (!q) return this.getGroupedParameters();
    return this.getGroupedParameters().map(g => ({
      ...g,
      parameters: g.parameters.filter(p =>
        p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
      )
    }));
  }

  /** Insert a key into the currently selected cell as a parameter type */
  insertKeyToCell(key: string): void {
    if (!this.selectedCell) {
      this.snackBar.open('Click a cell first, then insert', 'Close', { duration: 2000 });
      return;
    }
    this.cellEditType = 'parameter';
    this.cellEditContent = key;
    this.applyCellEdit();
  }

  formatNum(n: number): string {
    if (n === undefined || n === null) return '—';
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  onTemplateChange() {
    if (!this.selectedTemplateId) return;
    this.loading = true;
    this.selectedCells = [];
    this.selectedCell = null;
    this.undoStack = [];

    this.api.getReportTemplate(this.selectedTemplateId).subscribe({
      next: (tpl) => {
        this.template = tpl;
        this.loading = false;
      },
      error: (err) => {
        this.snackBar.open('Failed to load template', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  createNewTemplate() {
    const name = prompt('Enter a name for the new template:');
    if (!name) return;

    this.loading = true;
    const newTemplate: Partial<ReportTemplate> = {
      productId: this.sourceType === 'product' ? this.selectedProductId : undefined,
      masterProductId: this.sourceType === 'master' ? this.selectedMasterId : undefined,
      sourceType: this.sourceType,
      templateName: name,
      rowCount: 10,
      colCount: 4,
      cells: [],
      colWidths: [],
      rowHeights: []
    };

    this.api.createReportTemplate(newTemplate).subscribe({
      next: (tpl) => {
        this.templates.push(tpl);
        this.selectedTemplateId = tpl._id as string;
        this.template = tpl;
        this.snackBar.open('Template created', 'Close', { duration: 3000 });
        this.loading = false;
      },
      error: (err) => {
        this.snackBar.open('Failed to create template', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getRowsArray(): number[] {
    return Array(this.template.rowCount).fill(0).map((x, i) => i);
  }

  getColsArray(): number[] {
    return Array(this.template.colCount).fill(0).map((x, i) => i);
  }

  getCell(r: number, c: number): ReportTemplateCell | undefined {
    return this.template.cells.find(cell => cell.row === r && cell.col === c);
  }

  selectCell(r: number, c: number, event: MouseEvent) {
    if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      const idx = this.selectedCells.findIndex(sc => sc.row === r && sc.col === c);
      if (idx >= 0) {
        this.selectedCells.splice(idx, 1);
      } else {
        this.selectedCells.push({ row: r, col: c });
      }
    } else if (event.shiftKey && this.selectedCells.length > 0) {
      // Range selection from the primary cell (last selected or first in array)
      const primary = this.selectedCell || this.selectedCells[0];
      const minRow = Math.min(primary.row, r);
      const maxRow = Math.max(primary.row, r);
      const minCol = Math.min(primary.col, c);
      const maxCol = Math.max(primary.col, c);
      
      this.selectedCells = [];
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          this.selectedCells.push({ row, col });
        }
      }
    } else {
      // Single selection
      this.selectedCells = [{ row: r, col: c }];
    }

    // Set the primary selected cell
    this.selectedCell = this.selectedCells.length > 0 ? this.selectedCells[this.selectedCells.length - 1] : null;

    if (!this.selectedCell) return;

    const existing = this.getCell(this.selectedCell.row, this.selectedCell.col);
    if (existing) {
      this.cellEditType = existing.type;
      this.cellEditContent = existing.content;
      this.cellEditBold = existing.bold || false;
      this.cellEditAlign = existing.align || 'left';
      this.cellEditColSpan = existing.colSpan || 1;
      this.cellEditRowSpan = existing.rowSpan || 1;
      this.cellEditThickBorder = existing.thickBorder || false;
      this.cellEditBgColor = existing.bgColor || '';
      this.cellEditFontColor = existing.fontColor || '';
    } else {
      this.cellEditType = 'text';
      this.cellEditContent = '';
      this.cellEditBold = false;
      this.cellEditAlign = 'left';
      this.cellEditColSpan = 1;
      this.cellEditRowSpan = 1;
      this.cellEditThickBorder = false;
      this.cellEditBgColor = '';
      this.cellEditFontColor = '';
    }
  }

  saveState() {
    // Save a deep copy of the current cells to the undo stack
    this.undoStack.push(JSON.parse(JSON.stringify(this.template.cells)));
    // Limit stack size to prevent memory issues
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
  }

  undo() {
    if (this.undoStack.length === 0) return;
    // Pop the last state and restore it
    const lastState = this.undoStack.pop();
    if (lastState) {
      this.template.cells = lastState;
      // Re-evaluate selected cell toolbar state
      if (this.selectedCell) {
        // Just re-trigger the selection to update the toolbar
        this.selectCell(this.selectedCell.row, this.selectedCell.col, { ctrlKey: false, shiftKey: false, metaKey: false } as MouseEvent);
      }
    }
  }

  applyCellEdit() {
    if (!this.selectedCells || this.selectedCells.length === 0) return;
    
    this.saveState();
    
    for (const sc of this.selectedCells) {
      // Find existing cell
      const existingIdx = this.template.cells.findIndex(c => c.row === sc.row && c.col === sc.col);
      
      // The primary cell gets the text content, type, colSpan, rowSpan.
      // Other selected cells ONLY get the styling (bold, align, thickBorder).
      const isPrimary = this.selectedCell && sc.row === this.selectedCell.row && sc.col === this.selectedCell.col;
      
      let contentToApply = '';
      let colSpanToApply = 1;
      let rowSpanToApply = 1;
      let typeToApply: 'text' | 'parameter' = 'text';
      
      if (isPrimary) {
        contentToApply = this.cellEditContent;
        colSpanToApply = this.cellEditColSpan;
        rowSpanToApply = this.cellEditRowSpan;
        typeToApply = this.cellEditType;
      } else {
        const existing = this.getCell(sc.row, sc.col);
        contentToApply = existing ? existing.content : '';
        colSpanToApply = existing ? (existing.colSpan || 1) : 1;
        rowSpanToApply = existing ? (existing.rowSpan || 1) : 1;
        typeToApply = existing ? existing.type : 'text';
      }

      // Remove existing to replace it
      if (existingIdx >= 0) {
        this.template.cells.splice(existingIdx, 1);
      }

      // Add new if there's content or styling
      if (contentToApply.trim() !== '' || this.cellEditThickBorder || colSpanToApply > 1 || rowSpanToApply > 1 || this.cellEditBold || this.cellEditBgColor || this.cellEditFontColor) {
        this.template.cells.push({
          row: sc.row,
          col: sc.col,
          type: typeToApply,
          content: contentToApply,
          bold: this.cellEditBold,
          align: this.cellEditAlign,
          colSpan: colSpanToApply,
          rowSpan: rowSpanToApply,
          thickBorder: this.cellEditThickBorder,
          bgColor: this.cellEditBgColor,
          fontColor: this.cellEditFontColor
        });
      }
    }
  }

  clearCell() {
    if (!this.selectedCells || this.selectedCells.length === 0) return;
    
    this.saveState();

    for (const sc of this.selectedCells) {
      this.template.cells = this.template.cells.filter(c => !(c.row === sc.row && c.col === sc.col));
    }
    
    this.cellEditContent = '';
    this.cellEditColSpan = 1;
    this.cellEditRowSpan = 1;
    this.cellEditThickBorder = false;
    this.cellEditBold = false;
    this.cellEditBgColor = '';
    this.cellEditFontColor = '';
  }

  // -- Copy / Paste ----------------------------------------------------------
  copySelectedCells(): void {
    if (!this.selectedCells.length) return;
    const minRow = Math.min(...this.selectedCells.map(s => s.row));
    const minCol = Math.min(...this.selectedCells.map(s => s.col));
    this.copiedCells = [];
    const processedCells = new Set<string>();

    for (const s of this.selectedCells) {
      const cell = this.getCell(s.row, s.col);
      
      // If we've already processed this specific cell (e.g. it's part of a span we already handled), skip
      const cellKey = cell ? `${cell.row},${cell.col}` : `${s.row},${s.col}`;
      if (processedCells.has(cellKey)) continue;
      processedCells.add(cellKey);

      this.copiedCells.push({
        rowOffset: (cell ? cell.row : s.row) - minRow,
        colOffset: (cell ? cell.col : s.col) - minCol,
        cell: cell ? JSON.parse(JSON.stringify(cell)) : { row: s.row, col: s.col, type: 'text' as const, content: '' }
      });
    }
    
    // Also copy as plain text to system clipboard for external pasting
    const textRows: string[][] = [];
    const rows = Array.from(new Set(this.selectedCells.map(s => s.row))).sort((a,b) => a-b);
    const cols = Array.from(new Set(this.selectedCells.map(s => s.col))).sort((a,b) => a-b);
    
    rows.forEach(r => {
      const rowData: string[] = [];
      cols.forEach(c => {
        const cell = this.getCell(r, c);
        rowData.push(cell ? cell.content : '');
      });
      textRows.push(rowData);
    });
    
    const tsv = textRows.map(r => r.join('\t')).join('\n');
    this.lastInternalTsv = tsv;
    this.copyToClipboard(tsv);

    this.snackBar.open('Copied ' + this.copiedCells.length + ' cell(s)', 'Close', { duration: 2000 });
  }



  pasteSelectedCells(): void {
    if (!this.copiedCells.length || !this.selectedCell) return;
    this.saveState();
    
    const targetRow = this.selectedCell.row;
    const targetCol = this.selectedCell.col;

    for (const copied of this.copiedCells) {
      const newRow = targetRow + copied.rowOffset;
      const newCol = targetCol + copied.colOffset;
      
      // Bounds check
      if (newRow >= this.template.rowCount || newCol >= this.template.colCount) continue;
      
      const c = copied.cell;
      const cs = c.colSpan || 1;
      const rs = c.rowSpan || 1;

      // 1. Clear ANY existing cells that would overlap with this new cell's span
      for (let r = newRow; r < newRow + rs; r++) {
        for (let col = newCol; col < newCol + cs; col++) {
          const idx = this.template.cells.findIndex(cell => cell.row === r && cell.col === col);
          if (idx >= 0) this.template.cells.splice(idx, 1);
        }
      }

      // 2. Push the new cell if it has any meaningful content or design
      if (c.content?.trim() !== '' || c.bold || c.thickBorder || cs > 1 || rs > 1 || c.bgColor || c.fontColor || c.type === 'parameter') {
        this.template.cells.push({ 
          ...JSON.parse(JSON.stringify(c)), // deep copy to be safe
          row: newRow, 
          col: newCol 
        });
      }
    }
    this.snackBar.open('Pasted ' + this.copiedCells.length + ' cell(s) with design', 'Close', { duration: 2000 });
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    const ctrl = event.ctrlKey || event.metaKey;
    if (!ctrl) return;

    // Don't intercept if user is typing in an input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    if (event.key === 'c' || event.key === 'C') { this.copySelectedCells(); }
    else if (event.key === 'z' || event.key === 'Z') { event.preventDefault(); this.undo(); }
    // Ctrl+V is handled by handleExternalPaste (paste event)
  }

  @HostListener('document:paste', ['$event'])
  handleExternalPaste(event: ClipboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const clipboardData = event.clipboardData?.getData('text');
    if (!clipboardData || !this.selectedCell) return;

    event.preventDefault();

    // Heuristic: If clipboard text matches our last internal copy, use internal paste to keep styling
    if (this.copiedCells.length > 0 && clipboardData === this.lastInternalTsv) {
      this.pasteSelectedCells();
      return;
    }

    // Otherwise, parse as Excel/TSV
    this.saveState();
    const rows = clipboardData.split(/\r?\n/);
    if (rows.length > 1 && rows[rows.length - 1].trim() === '') rows.pop();

    const startRow = this.selectedCell.row;
    const startCol = this.selectedCell.col;

    rows.forEach((rowText, rIndex) => {
      const cols = rowText.split('\t');
      cols.forEach((cellText, cIndex) => {
        const targetRow = startRow + rIndex;
        const targetCol = startCol + cIndex;
        if (targetRow >= this.template.rowCount || targetCol >= this.template.colCount) return;

        const content = cellText.trim();
        const isParam = this.parameters.some(p => p.key === content);
        const type = isParam ? 'parameter' : 'text';

        const existingIdx = this.template.cells.findIndex(c => c.row === targetRow && c.col === targetCol);
        if (existingIdx >= 0) {
          this.template.cells[existingIdx].content = content;
          this.template.cells[existingIdx].type = type;
        } else if (content !== '') {
          this.template.cells.push({
            row: targetRow,
            col: targetCol,
            type: type,
            content: content,
            bold: false,
            align: 'left',
            colSpan: 1,
            rowSpan: 1,
            thickBorder: false
          });
        }
      });
    });

    this.snackBar.open(`Pasted from clipboard`, 'Close', { duration: 2000 });
  }



  isSelected(r: number, c: number): boolean {
    return this.selectedCells.findIndex(sc => sc.row === r && sc.col === c) >= 0;
  }

  // --- HTML5 Drag and Drop Handlers ---
  onDragStart(event: DragEvent, paramKey: string) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', paramKey);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); // allow drop
  }

  onDrop(event: DragEvent, r: number, c: number) {
    event.preventDefault();
    const paramKey = event.dataTransfer?.getData('text/plain');
    if (paramKey) {
      // Find and update the cell as primary
      this.selectCell(r, c, { ctrlKey: false, shiftKey: false, metaKey: false } as MouseEvent);
      this.cellEditType = 'parameter';
      this.cellEditContent = paramKey;
      this.applyCellEdit();
    }
  }

  saveTemplate() {
    if (!this.selectedTemplateId) {
      this.snackBar.open('Please select or create a template first.', 'Close', { duration: 3000 });
      return;
    }
    this.saving = true;
    this.api.saveReportTemplate(this.selectedTemplateId, this.template).subscribe({
      next: (res) => {
        this.template = res;
        this.snackBar.open('Template saved successfully', 'Close', { duration: 3000 });
        this.saving = false;
      },
      error: (err) => {
        this.snackBar.open('Failed to save template', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  deleteTemplate() {
    if (!this.selectedTemplateId) return;
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    this.api.deleteReportTemplate(this.selectedTemplateId).subscribe({
      next: () => {
        this.templates = this.templates.filter(t => t._id !== this.selectedTemplateId);
        this.selectedTemplateId = '';
        this.template = { rowCount: 10, colCount: 4, cells: [], colWidths: [], rowHeights: [] };
        this.snackBar.open('Template deleted', 'Close', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to delete', 'Close', { duration: 3000 })
    });
  }

  // Grid sizing
  addRow() {
    this.template.rowCount++;
    if (!this.template.rowHeights) this.template.rowHeights = [];
  }
  removeRow() {
    if (this.template.rowCount > 1) {
      this.template.rowCount--;
      if (this.template.rowHeights) this.template.rowHeights.pop();
    }
  }
  addCol() {
    this.template.colCount++;
    if (!this.template.colWidths) this.template.colWidths = [];
  }
  removeCol() {
    if (this.template.colCount > 1) {
      this.template.colCount--;
      if (this.template.colWidths) this.template.colWidths.pop();
    }
  }

  // ── Resize helpers ──────────────────────────────────────────────────────
  getColWidth(c: number): number {
    return (this.template.colWidths && this.template.colWidths[c]) || 150;
  }

  getRowHeight(r: number): number {
    return (this.template.rowHeights && this.template.rowHeights[r]) || 40;
  }

  startColResize(event: MouseEvent, colIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizingCol = colIndex;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.getColWidth(colIndex);

    const onMove = (e: MouseEvent) => {
      if (this.resizingCol === null) return;
      const delta = e.clientX - this.resizeStartX;
      const newWidth = Math.max(40, this.resizeStartWidth + delta);
      if (!this.template.colWidths) this.template.colWidths = [];
      // Pad array if needed
      while (this.template.colWidths.length <= this.resizingCol) {
        this.template.colWidths.push(150);
      }
      this.template.colWidths[this.resizingCol] = newWidth;
      // Force Angular change detection
      this.template = { ...this.template, colWidths: [...this.template.colWidths] };
    };

    const onUp = () => {
      this.resizingCol = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  startRowResize(event: MouseEvent, rowIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizingRow = rowIndex;
    this.resizeStartY = event.clientY;
    this.resizeStartHeight = this.getRowHeight(rowIndex);

    const onMove = (e: MouseEvent) => {
      if (this.resizingRow === null) return;
      const delta = e.clientY - this.resizeStartY;
      const newHeight = Math.max(24, this.resizeStartHeight + delta);
      if (!this.template.rowHeights) this.template.rowHeights = [];
      while (this.template.rowHeights.length <= this.resizingRow) {
        this.template.rowHeights.push(40);
      }
      this.template.rowHeights[this.resizingRow] = newHeight;
      this.template = { ...this.template, rowHeights: [...this.template.rowHeights] };
    };

    const onUp = () => {
      this.resizingRow = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  isCellHidden(r: number, c: number): boolean {
    for (const cell of this.template.cells) {
      const cs = cell.colSpan || 1;
      const rs = cell.rowSpan || 1;
      // The origin cell is not hidden
      if (cell.row === r && cell.col === c) continue;
      // If the (r, c) falls within the boundary of an expanded cell, it should be hidden
      if (r >= cell.row && r < cell.row + rs && c >= cell.col && c < cell.col + cs) {
        return true;
      }
    }
    return false;
  }

  getParameterName(key: string): string {
    // Master source: check scope items
    if (this.sourceType === 'master') {
      const item = this.masterScopeItems.find(x => x.key === key);
      return item ? item.name : key;
    }
    // Product source
    const p = this.parameters.find(x => x.key === key);
    return p ? p.name : key;
  }

  getGroupedParameters() {
    const groups: Record<string, { header: string; headerObj: any; parameters: Parameter[] }> = {};
    
    this.parameters.forEach(p => {
      const headerObj = (p.headerInfoId as any) || { _id: 'other', name: 'Other Parameters', index: 9999 };
      const headerId = headerObj._id;
      
      if (!groups[headerId]) {
        groups[headerId] = { header: headerObj.name, headerObj, parameters: [] };
      }
      groups[headerId].parameters.push(p);
    });

    const result = Object.values(groups).map(g => {
      g.parameters.sort((a, b) => {
        const idxA = a.index !== undefined && a.index !== null ? a.index : 9999;
        const idxB = b.index !== undefined && b.index !== null ? b.index : 9999;
        return idxA - idxB;
      });
      return g;
    });

    result.sort((a, b) => {
      const idxA = a.headerObj.index !== undefined && a.headerObj.index !== null ? a.headerObj.index : 9999;
      const idxB = b.headerObj.index !== undefined && b.headerObj.index !== null ? b.headerObj.index : 9999;
      return idxA - idxB;
    });

    return result;
  }
  private copyToClipboard(text: string): void {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Clipboard API failed, falling back...', err);
        this.copyToClipboardFallback(text);
      });
    } else {
      this.copyToClipboardFallback(text);
    }
  }

  private copyToClipboardFallback(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (!successful) console.error('document.execCommand(copy) was unsuccessful');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  }

  // ── Dialog Parameter Creation & Validation Logic ─────────────────────────
  loadMetaForDialog(): void {
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

  setupDialogFormulaValidation(): void {
    this.dialogFormulaInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((formula) => {
          this.dialogValidatingFormula = true;
          this.dialogFormulaValid = null;
          this.dialogExtractedVars = [];
          return this.api.validateFormula(formula);
        })
      )
      .subscribe({
        next: (result) => {
          this.dialogFormulaValid = result.valid;
          this.dialogFormulaError = result.error || '';
          this.dialogExtractedVars = result.variables || [];
          this.dialogValidatingFormula = false;
        },
        error: (err) => {
          this.dialogFormulaValid = false;
          this.dialogFormulaError = err.error?.error || 'Validation failed';
          this.dialogValidatingFormula = false;
        },
      });
  }

  onDialogFormulaChange(value: string): void {
    if (value.trim().length > 0) {
      this.dialogFormulaInput$.next(value.trim());
    } else {
      this.dialogFormulaValid = null;
      this.dialogExtractedVars = [];
    }
  }

  getSelectedParamKeys(): string[] {
    if (!this.selectedCells || this.selectedCells.length === 0) return [];
    const keys: string[] = [];
    this.selectedCells.forEach(sc => {
      const cell = this.getCell(sc.row, sc.col);
      if (cell && cell.type === 'parameter' && cell.content) {
        if (!keys.includes(cell.content)) {
          keys.push(cell.content);
        }
      }
    });
    return keys;
  }

  openParamCreateDialog(template: any): void {
    const selectedKeys = this.getSelectedParamKeys();
    
    // Determine category based on currently selected product
    let initialCatIds: string[] = [];
    if (this.sourceType === 'product' && this.selectedProductId) {
      const product = this.products.find(p => p._id === this.selectedProductId);
      if (product) {
        const catId = (product.categoryId as any)._id || (product.categoryId as unknown as string);
        if (catId) {
          initialCatIds = [catId];
        }
      }
    }

    // Pre-populate parameter form
    this.dialogParamForm = {
      name: '',
      key: '',
      type: 'formula',
      formula: selectedKeys.join(' + '),
      unitId: '',
      headerInfoId: '',
      categoryIds: initialCatIds,
      index: null
    };

    this.dialogFormulaValid = null;
    this.dialogFormulaError = '';
    this.dialogExtractedVars = [];
    
    // Open Dialog
    this.dialog.open(template, {
      width: '650px',
      disableClose: true
    });

    if (this.dialogParamForm.formula) {
      this.onDialogFormulaChange(this.dialogParamForm.formula);
    }
  }

  insertKeyInDialogFormula(key: string, inputElement?: HTMLInputElement): void {
    const insertStr = ` ${key} `;
    if (!inputElement) {
      this.dialogParamForm.formula = (this.dialogParamForm.formula || '').trimEnd() + insertStr;
      this.onDialogFormulaChange(this.dialogParamForm.formula);
      return;
    }
    const start = inputElement.selectionStart || 0;
    const end = inputElement.selectionEnd || 0;
    const current = this.dialogParamForm.formula || '';
    
    this.dialogParamForm.formula = current.substring(0, start) + insertStr + current.substring(end);
    
    setTimeout(() => {
      inputElement.focus();
      inputElement.setSelectionRange(start + insertStr.length, start + insertStr.length);
    }, 0);
    
    this.onDialogFormulaChange(this.dialogParamForm.formula);
  }

  insertOperatorInDialogFormula(op: string, inputElement?: HTMLInputElement): void {
    if (!inputElement) {
      this.dialogParamForm.formula = (this.dialogParamForm.formula || '') + op;
      this.onDialogFormulaChange(this.dialogParamForm.formula);
      return;
    }
    const start = inputElement.selectionStart ?? this.dialogParamForm.formula.length;
    const end = inputElement.selectionEnd ?? start;
    const current = this.dialogParamForm.formula || '';
    this.dialogParamForm.formula = current.substring(0, start) + op + current.substring(end);
    
    setTimeout(() => {
      inputElement.focus();
      inputElement.setSelectionRange(start + op.length, start + op.length);
    }, 0);
    
    this.onDialogFormulaChange(this.dialogParamForm.formula);
  }

  saveDialogParameter(): void {
    if (!this.dialogParamForm.name.trim() || !this.dialogParamForm.key.trim()) {
      this.snackBar.open('Name and Key are required', 'Close', { duration: 3000 });
      return;
    }
    if (this.dialogParamForm.type === 'formula') {
      if (!this.dialogParamForm.formula.trim()) {
        this.snackBar.open('Formula is required', 'Close', { duration: 3000 });
        return;
      }
      if (this.dialogFormulaValid === false) {
        this.snackBar.open('Please fix the formula error before saving', 'Close', { duration: 3000 });
        return;
      }
    }

    this.savingDialogParam = true;

    const payload: any = {
      name: this.dialogParamForm.name,
      key: this.dialogParamForm.key,
      type: this.dialogParamForm.type,
      formula: this.dialogParamForm.formula,
      unit: this.dialogParamForm.unitId || null,
      headerInfoId: this.dialogParamForm.headerInfoId || null,
      categoryIds: this.dialogParamForm.categoryIds,
      index: this.dialogParamForm.index
    };

    this.api.createParameter(payload).subscribe({
      next: (newParam) => {
        this.savingDialogParam = false;
        this.snackBar.open('Parameter created successfully!', 'Close', { duration: 3000 });
        this.dialog.closeAll();
        
        // Refresh product parameters list so sidebar has the new parameter
        if (this.selectedProductId) {
          this.onProductChange();
        } else if (this.selectedMasterId) {
          this.onMasterChange();
        }

        // Auto-assign the newly created parameter to the primary selected cell
        if (this.selectedCell) {
          this.cellEditType = 'parameter';
          this.cellEditContent = newParam.key;
          this.applyCellEdit();
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to create parameter', 'Close', { duration: 3000 });
        this.savingDialogParam = false;
      }
    });
  }
}
