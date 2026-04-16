import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Category } from '../../models/interfaces';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category.component.html',
  styleUrl: './category.component.css',
})
export class CategoryComponent implements OnInit {
  categories: Category[] = [];
  loading = false;
  formVisible = false;
  editMode = false;
  saving = false;
  error = '';
  success = '';

  form: { name: string } = { name: '' };
  editId = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load categories';
        this.loading = false;
      },
    });
  }

  openCreate(): void {
    this.editMode = false;
    this.editId = '';
    this.form = { name: '' };
    this.error = '';
    this.success = '';
    this.formVisible = true;
  }

  openEdit(cat: Category): void {
    this.editMode = true;
    this.editId = cat._id;
    this.form = { name: cat.name };
    this.error = '';
    this.success = '';
    this.formVisible = true;
  }

  closeForm(): void {
    this.formVisible = false;
    this.error = '';
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.error = 'Category name is required';
      return;
    }
    this.saving = true;
    this.error = '';

    const req = this.editMode
      ? this.api.updateCategory(this.editId, this.form)
      : this.api.createCategory(this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.success = this.editMode ? 'Category updated!' : 'Category created!';
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
    if (!confirm(`Delete category "${name}"?`)) return;
    this.api.deleteCategory(id).subscribe({
      next: () => {
        this.success = 'Category deleted';
        this.load();
        setTimeout(() => (this.success = ''), 3000);
      },
      error: (err) => (this.error = err.error?.message || 'Failed to delete'),
    });
  }
}
