import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ReportHistory } from '../../models/interfaces';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-report-history-view',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatSnackBarModule, DatePipe],
  template: `
    <div class="report-wrapper">
      <div class="print-controls">
        <button mat-flat-button color="primary" (click)="print()" style="padding:24px 32px; border-radius:12px; font-size:1.1rem;">
          <mat-icon style="margin-right:8px;">print</mat-icon> Print / Download PDF
        </button>
        <button mat-stroked-button onclick="history.back()" style="padding:16px 32px; border-radius:12px; background:white; border-color:#cbd5e1;">
          <mat-icon style="margin-right:8px;">arrow_back</mat-icon> Go Back
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
            <div style="margin-top:8px; display:inline-block; padding:4px 12px; background:#fef9c3; border:1px solid #fde68a; border-radius:6px; font-size:0.8rem; color:#92400e;">
              📸 Read-only History Snapshot
            </div>
          </div>

          <div style="margin-top:2rem;">
            <h3 style="margin:0 0 1rem 0; color:#0077b6; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.05em;">Input Values</h3>
            <table class="report-table">
              <tbody>
                @for (entry of getEntries(snapshot.inputs); track entry[0]) {
                  <tr>
                    <td class="col-name"><span class="param-name">{{ entry[0] }}</span></td>
                    <td class="col-badge"><span class="type-badge badge-input">Input</span></td>
                    <td class="col-value">{{ formatNumber(entry[1]) }}</td>
                  </tr>
                }
              </tbody>
            </table>

            <h3 style="margin:2rem 0 1rem 0; color:#7e22ce; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.05em;">Calculated Values</h3>
            <table class="report-table">
              <tbody>
                @for (entry of getEntries(snapshot.calculated); track entry[0]) {
                  <tr>
                    <td class="col-name"><span class="param-name">{{ entry[0] }}</span></td>
                    <td class="col-badge"><span class="type-badge badge-formula">Calculated</span></td>
                    <td class="col-value">{{ formatNumber(entry[1]) }}</td>
                  </tr>
                }
              </tbody>
            </table>
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

  constructor(private route: ActivatedRoute, private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading = false; return; }
    this.api.getReportHistoryById(id).subscribe({
      next: (h) => { this.snapshot = h; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  getEntries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj || {});
  }

  formatNumber(n: number): string {
    if (n === undefined || n === null) return '—';
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  print(): void { window.print(); }
}
