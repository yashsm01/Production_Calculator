import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Category,
  Unit,
  Parameter,
  Product,
  FormulaValidationResult,
  EngineResult,
  InputVariablesResult,
} from '../models/interfaces';

const BASE = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // ── Category ──────────────────────────────────────────────────────────────
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${BASE}/category`);
  }
  createCategory(data: { name: string }): Observable<Category> {
    return this.http.post<Category>(`${BASE}/category`, data);
  }
  updateCategory(id: string, data: { name: string }): Observable<Category> {
    return this.http.put<Category>(`${BASE}/category/${id}`, data);
  }
  deleteCategory(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/category/${id}`);
  }

  // ── Unit ─────────────────────────────────────────────────────────────────
  getUnits(): Observable<Unit[]> {
    return this.http.get<Unit[]>(`${BASE}/unit`);
  }
  createUnit(data: { name: string; symbol: string }): Observable<Unit> {
    return this.http.post<Unit>(`${BASE}/unit`, data);
  }
  updateUnit(id: string, data: { name: string; symbol: string }): Observable<Unit> {
    return this.http.put<Unit>(`${BASE}/unit/${id}`, data);
  }
  deleteUnit(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/unit/${id}`);
  }

  // ── Parameter ─────────────────────────────────────────────────────────────
  getParameters(categoryId?: string): Observable<Parameter[]> {
    let params = new HttpParams();
    if (categoryId) params = params.set('categoryId', categoryId);
    return this.http.get<Parameter[]>(`${BASE}/parameter`, { params });
  }
  createParameter(data: Partial<Parameter> & { isInput?: boolean }): Observable<Parameter> {
    return this.http.post<Parameter>(`${BASE}/parameter`, data);
  }
  updateParameter(id: string, data: Partial<Parameter> & { isInput?: boolean }): Observable<Parameter> {
    return this.http.put<Parameter>(`${BASE}/parameter/${id}`, data);
  }
  deleteParameter(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/parameter/${id}`);
  }
  validateFormula(formula: string, categoryId?: string, currentKey?: string): Observable<FormulaValidationResult> {
    return this.http.post<FormulaValidationResult>(`${BASE}/parameter/validate-formula`, {
      formula,
      ...(categoryId ? { categoryId } : {}),
      ...(currentKey ? { currentKey } : {}),
    });
  }
  getInputVariables(categoryId: string): Observable<InputVariablesResult> {
    let params = new HttpParams().set('categoryId', categoryId);
    return this.http.get<InputVariablesResult>(`${BASE}/parameter/inputs`, { params });
  }

  // ── Product ────────────────────────────────────────────────────────────────
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${BASE}/product`);
  }
  createProduct(data: {
    name: string;
    categoryId: string;
    inputs: Record<string, number>;
  }): Observable<EngineResult> {
    return this.http.post<EngineResult>(`${BASE}/product/create`, data);
  }
  deleteProduct(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/product/${id}`);
  }
}
