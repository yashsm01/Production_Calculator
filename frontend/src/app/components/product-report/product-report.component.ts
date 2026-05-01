import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Product, Parameter, ReportTemplate, ReportTemplateCell, ReportHistory } from '../../models/interfaces';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

interface ReportItem {
  name: string;
  key: string;
  value: number;
  unit: string;
  type: 'input' | 'formula';
  index: number;
}

interface ReportGroup {
  header: string;
  headerObj?: any;
  items: ReportItem[];
}

@Component({
  selector: 'app-product-report',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, FormsModule, MatTabsModule, MatButtonToggleModule, MatSelectModule],
  templateUrl: './product-report.component.html',
  styleUrl: './product-report.component.css'
})
export class ProductReportComponent implements OnInit {
  productId = '';
  product: Product | null = null;
  reportGroups: ReportGroup[] = [];
  customTemplate: ReportTemplate | null = null;
  hasCustomTemplate = false;
  templates: ReportTemplate[] = [];
  selectedTemplateId = '';
  loading = true;
  error: string | null = null;

  activeView: 'custom' | 'standard' = 'custom';
  savingHistory = false;
  showHeader = true;
  collapsedGroups = new Set<string>();
  private parametersMetadata: Parameter[] = [];


  toggleGroup(header: string): void {
    if (this.collapsedGroups.has(header)) {
      this.collapsedGroups.delete(header);
    } else {
      this.collapsedGroups.add(header);
    }
  }

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'No product ID provided in URL.';
      this.loading = false;
      return;
    }
    this.route.queryParams.subscribe(params => {
      if (params['view'] === 'standard') {
        this.activeView = 'standard';
      } else if (params['view'] === 'custom') {
        this.activeView = 'custom';
      }
    });

    this.productId = id;
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    
    // Fetch product details
    this.api.getProductById(this.productId).subscribe({
      next: (product) => {
        this.product = product;
        
        // Fetch ALL parameters to get metadata (Header Info, units)
        const catId = (product.categoryId as any)._id || product.categoryId as unknown as string;
        
        this.api.getInputVariables(catId).subscribe({
          next: (res) => {
            // First build standard report data (so we have parameter maps ready if needed)
            this.parametersMetadata = res.parameters;
            this.buildReport(product, res.parameters);

            
            // Now check for custom templates
            this.api.getReportTemplatesByProduct(product._id as string).subscribe({
              next: (tpls) => {
                if (tpls && tpls.length > 0) {
                  this.templates = tpls;
                  this.customTemplate = tpls[0];
                  this.selectedTemplateId = tpls[0]._id as string;
                  this.hasCustomTemplate = true;
                }
                this.loading = false;
              },
              error: () => {
                // No templates found or error, just use standard layout
                this.loading = false;
              }
            });
          },
          error: (err) => {
            this.error = 'Failed to load parameter metadata.';
            this.loading = false;
          }
        });
      },
      error: (err) => {
        this.error = 'Failed to load product details.';
        this.loading = false;
      }
    });
  }

  onTemplateChange() {
    if (!this.selectedTemplateId) return;
    const selected = this.templates.find(t => t._id === this.selectedTemplateId);
    if (selected) {
      this.customTemplate = selected;
    }
  }

  buildReport(product: Product, parameters: Parameter[]): void {
    const groups: Record<string, { headerObj: any; items: ReportItem[] }> = {};
    const paramMap: Record<string, Parameter> = {};
    parameters.forEach(p => paramMap[p.key] = p);

    const processRecord = (record: Record<string, number>, typeLabel: 'input' | 'formula') => {
      if (!record) return;
      Object.entries(record).forEach(([key, value]) => {
        const p = paramMap[key];
        // Skip hidden parameters (per-product setting) or unmapped variables
        if (product.hiddenParameters?.includes(key)) return;
        if (!p && typeLabel === 'formula') return; 
        
        const headerObj = (p?.headerInfoId as any);
        const headerId = headerObj?._id || 'other';

        if (!groups[headerId]) {
          groups[headerId] = { headerObj, items: [] };
        }

        groups[headerId].items.push({
          name: p?.name || this.formatKeyToName(key),
          key: key,
          value: value,
          unit: (p?.unit as any)?.symbol || '',
          type: typeLabel,
          index: p?.index || 0
        });
      });
    };

    processRecord(product.inputs, 'input');
    processRecord(product.calculated, 'formula');

    // Convert Record to Array and sort items alphabetically by name
    this.reportGroups = Object.values(groups).map(group => {
      // Sort by index first, then input/formula type, then name
      group.items.sort((a, b) => {
        if (a.index !== b.index) return a.index - b.index;
        if (a.type !== b.type) {
          return a.type === 'input' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      return { header: group.headerObj?.name || 'Other Specifications', headerObj: group.headerObj, items: group.items };
    });

    // Optionally sort groups by header index and then name
    this.reportGroups.sort((a, b) => {
      const idxA = a.headerObj?.index || 0;
      const idxB = b.headerObj?.index || 0;
      if (idxA !== idxB) return idxA - idxB;

      if (a.header === 'Other Specifications') return 1;
      if (b.header === 'Other Specifications') return -1;
      return a.header.localeCompare(b.header);
    });
  }

  formatKeyToName(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  formatNumber(n: number): string {
    if (n === undefined || n === null) return '—';
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  // Helper for custom template rendering
  getRowsArray(): number[] {
    if (!this.customTemplate) return [];
    return Array(this.customTemplate.rowCount).fill(0).map((x, i) => i);
  }

  getColsArray(): number[] {
    if (!this.customTemplate) return [];
    return Array(this.customTemplate.colCount).fill(0).map((x, i) => i);
  }

  getCell(r: number, c: number): ReportTemplateCell | undefined {
    return this.customTemplate?.cells.find(cell => cell.row === r && cell.col === c);
  }

  getColWidth(c: number): number {
    return (this.customTemplate?.colWidths && this.customTemplate.colWidths[c]) || 150;
  }

  getRowHeight(r: number): number {
    return (this.customTemplate?.rowHeights && this.customTemplate.rowHeights[r]) || 40;
  }

  getColsForGroup(): number[] {
    if (!this.customTemplate) return [];
    return this.getColsArray();
  }

  isCellHidden(r: number, c: number): boolean {
    if (!this.customTemplate) return false;
    for (const cell of this.customTemplate.cells) {
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

  getCellValue(cell: ReportTemplateCell): string {
    if (cell.type === 'text') {
      return cell.content;
    }
    
    // It's a parameter key
    const key = cell.content;
    
    // First check if it's hidden for this product
    if (this.product?.hiddenParameters?.includes(key)) {
      return '—';
    }

    let val = '—';
    if (this.product?.calculated && this.product.calculated[key] !== undefined) {
      val = this.formatNumber(this.product.calculated[key]);
    } else if (this.product?.inputs && this.product.inputs[key] !== undefined) {
      val = this.formatNumber(this.product.inputs[key]);
    }

    if (val !== '—') {
      const unit = this.getParameterUnit(key);
      if (unit) {
        return `${val} ${unit}`;
      }
    }
    
    return val;
  }

  isInputParameter(key: string): boolean {
    if (!this.product || !this.product.inputs) return false;
    return this.product.inputs.hasOwnProperty(key);
  }

  getParameterUnit(key: string): string {
    const p = this.parametersMetadata.find(x => x.key === key);
    return (p?.unit as any)?.symbol || '';
  }


  recalculate(): void {
    if (!this.product) return;
    
    // Call the backend to upsert the product. The backend engine will recalculate based on updated inputs.
    // Our API createProduct handles both create and update.
    const payload = {
      _id: this.product._id,
      name: this.product.name,
      categoryId: (this.product.categoryId as any)._id || this.product.categoryId,
      inputs: this.product.inputs,
      hiddenParameters: this.product.hiddenParameters || []
    };

    this.api.createProduct(payload).subscribe({
      next: (res) => {
        // The backend returns the recalculated product
        this.product = res.product;
        // The standard report Groups need to be rebuilt in case they are shown
        // But the custom template just reads directly from this.product, so it updates instantly!
      },
      error: (err) => {
        this.snackBar.open('Error recalculating values.', 'Close', { duration: 3000 });
      }
    });
  }

  saveAndDownload(): void {
    if (!this.product) return;
    
    const notes = prompt('Enter a label for this report snapshot (optional, e.g. "Rev A", "Client Quote"):') ?? '';

    const categoryName = (this.product.categoryId as any)?.name || '';
    const payload = {
      productId: this.product._id as string,
      productName: this.product.name,
      categoryName,
      inputs: { ...this.product.inputs },
      calculated: { ...this.product.calculated },
      notes,
    };

    this.savingHistory = true;
    this.api.saveReportHistory(payload).subscribe({
      next: () => {
        this.savingHistory = false;
        window.print();
        this.snackBar.open('✅ Report saved to history!', 'Close', { duration: 2500 });
      },
      error: () => {
        this.savingHistory = false;
        this.snackBar.open('⚠️ Could not save history, printing anyway.', 'Close', { duration: 3000 });
        window.print();
      }
    });
  }

  printReport(): void {
    window.print();
  }
}
