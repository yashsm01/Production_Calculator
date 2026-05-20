export function FormatDecimal(digits: number = 2) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    descriptor.value = function (n: any): string {
      if (n === undefined || n === null) return '—';
      const num = typeof n === 'number' ? n : parseFloat(n);
      if (isNaN(num)) return '—';
      return num.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    };
    return descriptor;
  };
}
