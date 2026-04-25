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
  HeaderInfo,
  ReportTemplate,
  ReportHistory,
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

  // ── Header Info ────────────────────────────────────────────────────────────
  getHeaderInfos(): Observable<HeaderInfo[]> {
    return this.http.get<HeaderInfo[]>(`${BASE}/header-info`);
  }
  createHeaderInfo(data: { name: string; description?: string }): Observable<HeaderInfo> {
    return this.http.post<HeaderInfo>(`${BASE}/header-info`, data);
  }
  updateHeaderInfo(id: string, data: { name: string; description?: string }): Observable<HeaderInfo> {
    return this.http.put<HeaderInfo>(`${BASE}/header-info/${id}`, data);
  }
  deleteHeaderInfo(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/header-info/${id}`);
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
  createParameter(data: Partial<Parameter>): Observable<Parameter> {
    return this.http.post<Parameter>(`${BASE}/parameter`, data);
  }
  updateParameter(id: string, data: Partial<Parameter>): Observable<Parameter> {
    return this.http.put<Parameter>(`${BASE}/parameter/${id}`, data);
  }
  deleteParameter(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/parameter/${id}`);
  }
  validateFormula(formula: string): Observable<FormulaValidationResult> {
    return this.http.post<FormulaValidationResult>(`${BASE}/parameter/validate-formula`, {
      formula,
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
  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${BASE}/product/${id}`);
  }
  createProduct(data: {
    name: string;
    categoryId: string;
    inputs: Record<string, number>;
    hiddenParameters?: string[];
  }): Observable<EngineResult> {
    return this.http.post<EngineResult>(`${BASE}/product/create`, data);
  }
  deleteProduct(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/product/${id}`);
  }

  // ── Report Template ─────────────────────────────────────────────────────────
  getReportTemplate(productId: string): Observable<ReportTemplate> {
    return this.http.get<ReportTemplate>(`${BASE}/report-template/${productId}`);
  }
  saveReportTemplate(productId: string, data: Partial<ReportTemplate>): Observable<ReportTemplate> {
    return this.http.put<ReportTemplate>(`${BASE}/report-template/${productId}`, data);
  }
  deleteReportTemplate(productId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/report-template/${productId}`);
  }

  // ── Report History ───────────────────────────────────────────────────────────
  saveReportHistory(data: {
    productId: string;
    productName: string;
    categoryName: string;
    inputs: Record<string, number>;
    calculated: Record<string, number>;
    notes: string;
  }): Observable<{ message: string; history: ReportHistory }> {
    return this.http.post<{ message: string; history: ReportHistory }>(`${BASE}/report-history`, data);
  }
  getReportHistory(productId: string): Observable<ReportHistory[]> {
    return this.http.get<ReportHistory[]>(`${BASE}/report-history/product/${productId}`);
  }
  getReportHistoryById(id: string): Observable<ReportHistory> {
    return this.http.get<ReportHistory>(`${BASE}/report-history/${id}`);
  }
  deleteReportHistory(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/report-history/${id}`);
  }
}
