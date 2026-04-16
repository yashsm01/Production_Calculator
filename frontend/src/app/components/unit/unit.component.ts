import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Unit } from '../../models/interfaces';

@Component({
  selector: 'app-unit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './unit.component.html',
  styleUrl: './unit.component.css',
})
export class UnitComponent implements OnInit {
  units: Unit[] = [];
  loading = false;
  formVisible = false;
  editMode = false;
  saving = false;
  error = '';
  success = '';

  form: { name: string; symbol: string } = { name: '', symbol: '' };
  editId = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getUnits().subscribe({
      next: (data) => {
        this.units = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load units';
        this.loading = false;
      },
    });
  }

  openCreate(): void {
    this.editMode = false;
    this.editId = '';
    this.form = { name: '', symbol: '' };
    this.error = '';
    this.success = '';
    this.formVisible = true;
  }

  openEdit(unit: Unit): void {
    this.editMode = true;
    this.editId = unit._id;
    this.form = { name: unit.name, symbol: unit.symbol };
    this.error = '';
    this.success = '';
    this.formVisible = true;
  }

  closeForm(): void {
    this.formVisible = false;
    this.error = '';
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.symbol.trim()) {
      this.error = 'Both name and symbol are required';
      return;
    }
    this.saving = true;
    this.error = '';

    const req = this.editMode
      ? this.api.updateUnit(this.editId, this.form)
      : this.api.createUnit(this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.success = this.editMode ? 'Unit updated!' : 'Unit created!';
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
    if (!confirm(`Delete unit "${name}"?`)) return;
    this.api.deleteUnit(id).subscribe({
      next: () => {
        this.success = 'Unit deleted';
        this.load();
        setTimeout(() => (this.success = ''), 3000);
      },
      error: (err) => (this.error = err.error?.message || 'Failed to delete'),
    });
  }
}
