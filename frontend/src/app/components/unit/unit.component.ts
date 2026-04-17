import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Unit } from '../../models/interfaces';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-unit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatSnackBarModule,
  ],
  templateUrl: './unit.component.html',
  styleUrl: './unit.component.css',
})
export class UnitComponent implements OnInit {
  dataSource = new MatTableDataSource<Unit>([]);
  displayedColumns: string[] = ['name', 'symbol', 'createdAt', 'actions'];

  @ViewChild(MatPaginator) set matPaginator(mp: MatPaginator) {
    this.dataSource.paginator = mp;
  }
  @ViewChild(MatSort) set matSort(ms: MatSort) {
    this.dataSource.sort = ms;
  }

  loading = false;
  formVisible = false;
  editMode = false;
  saving = false;

  form: { name: string; symbol: string } = { name: '', symbol: '' };
  editId = '';

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getUnits().subscribe({
      next: (data) => {
        this.dataSource.data = data;
        this.loading = false;
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to load units', 'Close', { duration: 3000 });
        this.loading = false;
      },
    });
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  openCreate(): void {
    this.editMode = false;
    this.editId = '';
    this.form = { name: '', symbol: '' };
    this.formVisible = true;
  }

  openEdit(unit: Unit): void {
    this.editMode = true;
    this.editId = unit._id;
    this.form = { name: unit.name, symbol: unit.symbol };
    this.formVisible = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm(): void {
    this.formVisible = false;
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.symbol.trim()) {
      this.snackBar.open('Both name and symbol are required', 'Close', { duration: 3000 });
      return;
    }
    this.saving = true;

    const req = this.editMode
      ? this.api.updateUnit(this.editId, this.form)
      : this.api.createUnit(this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(this.editMode ? 'Unit updated!' : 'Unit created!', 'Close', { duration: 3000 });
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
    if (!confirm(`Delete unit "${name}"?`)) return;
    this.api.deleteUnit(id).subscribe({
      next: () => {
        this.snackBar.open('Unit deleted', 'Close', { duration: 3000 });
        this.load();
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to delete', 'Close', { duration: 3000 });
      },
    });
  }
}
