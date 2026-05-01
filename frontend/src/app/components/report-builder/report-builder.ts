import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Category, Product, Parameter, ReportTemplate, ReportTemplateCell } from '../../models/interfaces';
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
    MatDialogModule
  ],
  templateUrl: './report-builder.html',
  styleUrl: './report-builder.css',
})
export class ReportBuilder implements OnInit {
  products: Product[] = [];
  selectedProductId = '';
  parameters: Parameter[] = [];
  
  templates: ReportTemplate[] = [];
  selectedTemplateId = '';

  template: ReportTemplate = {
    productId: '',
    templateName: '',
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

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.api.getProducts().subscribe(prods => this.products = prods);
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
      productId: this.selectedProductId,
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
    for (const s of this.selectedCells) {
      const cell = this.getCell(s.row, s.col);
      this.copiedCells.push({
        rowOffset: s.row - minRow,
        colOffset: s.col - minCol,
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
    navigator.clipboard.writeText(tsv).catch(err => console.error('Could not copy text: ', err));

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
      if (newRow >= this.template.rowCount || newCol >= this.template.colCount) continue;
      const idx = this.template.cells.findIndex(c => c.row === newRow && c.col === newCol);
      if (idx >= 0) this.template.cells.splice(idx, 1);
      const c = copied.cell;
      if (c.content?.trim() !== '' || c.bold || c.thickBorder || (c.colSpan || 1) > 1 || (c.rowSpan || 1) > 1 || c.bgColor || c.fontColor) {
        this.template.cells.push({ ...c, row: newRow, col: newCol });
      }
    }
    this.snackBar.open('Pasted ' + this.copiedCells.length + ' cell(s)', 'Close', { duration: 2000 });
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

        const existingIdx = this.template.cells.findIndex(c => c.row === targetRow && c.col === targetCol);
        if (existingIdx >= 0) {
          this.template.cells[existingIdx].content = cellText.trim();
          this.template.cells[existingIdx].type = 'text';
        } else if (cellText.trim() !== '') {
          this.template.cells.push({
            row: targetRow,
            col: targetCol,
            type: 'text',
            content: cellText.trim(),
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
        this.template = { productId: this.selectedProductId, templateName: '', rowCount: 10, colCount: 4, cells: [], colWidths: [], rowHeights: [] };
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
}
