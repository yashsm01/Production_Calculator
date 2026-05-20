import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ReportHistory } from '../../models/interfaces';
import { FormatDecimal } from '../../utils/decorators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface HistoryReportItem {
  name: string;
  key: string;
  value: number;
  unit: string;
  type: 'input' | 'formula';
  index: number;
}

interface HistoryReportGroup {
  header: string;
  headerObj?: any;
  items: HistoryReportItem[];
}

@Component({
  selector: 'app-report-history-view',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatSnackBarModule, DatePipe],
  template: `
    <div class="report-wrapper">
      <div class="print-controls">
        <button mat-flat-button color="primary" (click)="print()">
          <mat-icon style="margin-right:8px;">print</mat-icon> Print Snapshot
        </button>
        <button mat-stroked-button onclick="history.back()" style="background:white; border-color:#cbd5e1;">
          <mat-icon style="margin-right:8px;">arrow_back</mat-icon> Back
        </button>
      </div>

      <div class="report-container">
        @if (loading) {
          <div style="text-align:center; padding:4rem; color:#94a3b8;">
            <mat-icon style="font-size:48px; width:48px; height:48px; animation:spin 1s linear infinite;">sync</mat-icon>
            <p>Loading snapshot...</p>
          </div>
        } @else if (snapshot) {
          <div class="doc-header">
            <h1 class="doc-title">{{ snapshot.productName }}</h1>
            <p class="doc-meta">
              <strong>Category:</strong> {{ snapshot.categoryName || '—' }} &nbsp;&bull;&nbsp;
              <strong>Saved On:</strong> {{ snapshot.savedAt | date:'medium' }}
              @if (snapshot.notes) {
                &nbsp;&bull;&nbsp; <strong>Label:</strong> {{ snapshot.notes }}
              }
            </p>
            <div style="margin-top:8px; display:inline-block; padding:4px 12px; background:#fef9c3; border:1px solid #fde68a; border-radius:6px; font-size:0.8rem; color:#92400e; font-weight: 500;">
              📸 Read-only History Snapshot
            </div>
          </div>

          <div style="margin-top:2rem;">
            @for (group of reportGroups; track group.header) {
              <div class="group-section" style="margin-bottom: 2.5rem;">
                <h3 class="group-header" style="display:flex; align-items:center; gap:8px;">
                  <mat-icon style="color:#0077b6;">folder_open</mat-icon>
                  {{ group.header }}
                </h3>
                <div class="table-responsive">
                  <table class="report-table">
                    <tbody>
                      @for (item of group.items; track item.key) {
                        <tr>
                          <td class="col-name">
                            <span class="param-name">{{ item.name }}</span>
                            <span class="param-key" style="margin-top:2px;">{{ item.key }}</span>
                          </td>
                          <td class="col-badge">
                            <span class="type-badge" [class.badge-input]="item.type === 'input'" [class.badge-formula]="item.type === 'formula'">
                              {{ item.type === 'input' ? 'Input' : 'Calculated' }}
                            </span>
                          </td>
                          <td class="col-value">
                            {{ formatNumber(item.value) }}
                            @if (item.unit) { <span class="val-unit">{{ item.unit }}</span> }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        } @else {
          <p style="color:#ef4444;">Snapshot not found.</p>
        }
      </div>
    </div>
  `,
  styleUrl: '../product-report/product-report.component.css'
})
export class ReportHistoryViewComponent implements OnInit {
  loading = true;
  snapshot: ReportHistory | null = null;
  reportGroups: HistoryReportGroup[] = [];

  constructor(private route: ActivatedRoute, private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading = false; return; }
    this.api.getReportHistoryById(id).subscribe({
      next: (h) => {
        this.snapshot = h;
        this.buildReportGroups(h);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  buildReportGroups(snapshot: ReportHistory): void {
    const groups: Record<string, { headerObj: any; items: HistoryReportItem[] }> = {};
    const metadata = snapshot.parameterMetadata || {};
    const indices = snapshot.parameterIndices || {};
    const hidden = snapshot.hiddenParameters || [];

    const processRecord = (record: Record<string, number>, typeLabel: 'input' | 'formula') => {
      if (!record) return;
      Object.entries(record).forEach(([key, value]) => {
        if (hidden.includes(key)) return;
        const meta = metadata[key] || {};
        const headerObj = meta.header || null;
        const headerId = headerObj ? (headerObj.name || 'other') : 'other';

        if (!groups[headerId]) {
          groups[headerId] = {
            headerObj: headerObj ? { name: headerObj.name, index: headerObj.index !== undefined ? headerObj.index : 999 } : { name: 'Other Specifications', index: 999 },
            items: []
          };
        }

        const displayName = meta.label || meta.name || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const customIdx = indices[key];
        const idx = customIdx !== undefined ? customIdx : (meta.index !== undefined ? meta.index : 999);

        groups[headerId].items.push({
          name: displayName,
          key: key,
          value: value,
          unit: meta.unit || '',
          type: typeLabel,
          index: idx
        });
      });
    };

    processRecord(snapshot.inputs, 'input');
    processRecord(snapshot.calculated, 'formula');

    // Convert Record to Array and sort items within each group
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

    // Sort groups by header index and then name
    this.reportGroups.sort((a, b) => {
      const idxA = a.headerObj?.index !== undefined ? a.headerObj.index : 999;
      const idxB = b.headerObj?.index !== undefined ? b.headerObj.index : 999;
      if (idxA !== idxB) return idxA - idxB;

      if (a.header === 'Other Specifications') return 1;
      if (b.header === 'Other Specifications') return -1;
      return a.header.localeCompare(b.header);
    });
  }

  @FormatDecimal(2)
  formatNumber(n: number): string {
    return '';
  }

  print(): void { window.print(); }
}
