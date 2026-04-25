import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Product, Parameter } from '../../models/interfaces';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

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
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './product-report.component.html',
  styleUrl: './product-report.component.css'
})
export class ProductReportComponent implements OnInit {
  productId = '';
  product: Product | null = null;
  reportGroups: ReportGroup[] = [];
  loading = true;
  error = '';

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
            this.buildReport(product, res.parameters);
            this.loading = false;
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

  buildReport(product: Product, parameters: Parameter[]): void {
    const groups: Record<string, { headerObj: any; items: ReportItem[] }> = {};
    const paramMap: Record<string, Parameter> = {};
    parameters.forEach(p => paramMap[p.key] = p);

    const processRecord = (record: Record<string, number>, typeLabel: 'input' | 'formula') => {
      if (!record) return;
      Object.entries(record).forEach(([key, value]) => {
        const p = paramMap[key];
        // Skip unmapped variables (shouldn't happen, but safely guard)
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

  printReport(): void {
    window.print();
  }
}
