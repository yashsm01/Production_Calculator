import { Component, OnInit } from '@angular/core';
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
  
  template: ReportTemplate = {
    productId: '',
    rowCount: 10,
    colCount: 4,
    cells: []
  };

  loading = false;
  saving = false;

  // Selected cell for editing
  selectedCell: { row: number, col: number } | null = null;
  cellEditType: 'text' | 'parameter' = 'text';
  cellEditContent = '';
  cellEditBold = false;
  cellEditAlign: 'left' | 'center' | 'right' = 'left';

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.api.getProducts().subscribe(prods => this.products = prods);
  }

  onProductChange() {
    if (!this.selectedProductId) return;
    this.loading = true;
    this.parameters = [];
    this.selectedCell = null;
    
    // Find selected product
    const product = this.products.find(p => p._id === this.selectedProductId);
    if (!product) return;
    
    // Get category ID from product to fetch parameters
    const catId = (product.categoryId as any)._id || product.categoryId as unknown as string;
    
    // Fetch parameters
    this.api.getInputVariables(catId).subscribe(res => {
      this.parameters = res.parameters;
      
      // Fetch existing template
      this.api.getReportTemplate(this.selectedProductId).subscribe({
        next: (tpl) => {
          this.template = tpl;
          this.loading = false;
        },
        error: (err) => {
          // Defaults if not found
          this.template = {
            productId: this.selectedProductId,
            rowCount: 10,
            colCount: 4,
            cells: []
          };
          this.loading = false;
        }
      });
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

  selectCell(r: number, c: number) {
    this.selectedCell = { row: r, col: c };
    const existing = this.getCell(r, c);
    if (existing) {
      this.cellEditType = existing.type;
      this.cellEditContent = existing.content;
      this.cellEditBold = existing.bold || false;
      this.cellEditAlign = existing.align || 'left';
    } else {
      this.cellEditType = 'text';
      this.cellEditContent = '';
      this.cellEditBold = false;
      this.cellEditAlign = 'left';
    }
  }

  applyCellEdit() {
    if (!this.selectedCell) return;
    
    // Remove existing if any
    this.template.cells = this.template.cells.filter(
      c => !(c.row === this.selectedCell!.row && c.col === this.selectedCell!.col)
    );

    // Add new if there's content
    if (this.cellEditContent.trim() !== '') {
      this.template.cells.push({
        row: this.selectedCell.row,
        col: this.selectedCell.col,
        type: this.cellEditType,
        content: this.cellEditContent,
        bold: this.cellEditBold,
        align: this.cellEditAlign
      });
    }
  }

  clearCell() {
    this.cellEditContent = '';
    this.applyCellEdit();
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
      // Find and update the cell
      this.selectCell(r, c);
      this.cellEditType = 'parameter';
      this.cellEditContent = paramKey;
      this.applyCellEdit();
    }
  }

  saveTemplate() {
    if (!this.selectedProductId) return;
    this.saving = true;
    this.api.saveReportTemplate(this.selectedProductId, this.template).subscribe({
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
    if (!confirm('Are you sure you want to delete this template and revert to the auto-generated layout?')) return;
    
    this.api.deleteReportTemplate(this.selectedProductId).subscribe({
      next: () => {
        this.template.cells = [];
        this.snackBar.open('Template deleted', 'Close', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to delete', 'Close', { duration: 3000 })
    });
  }

  // Grid sizing
  addRow() { this.template.rowCount++; }
  removeRow() { if (this.template.rowCount > 1) this.template.rowCount--; }
  addCol() { this.template.colCount++; }
  removeCol() { if (this.template.colCount > 1) this.template.colCount--; }

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
