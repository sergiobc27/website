import { describe, expect, it, vi } from 'vitest';
import { importWithRetry } from './lazyWithRetry';

describe('importWithRetry', () => {
  it('resuelve al primer intento, sin reintentar', async () => {
    const factory = vi.fn().mockResolvedValue('ok');
    await expect(importWithRetry(factory, 2, 0)).resolves.toBe('ok');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('reintenta y resuelve si un intento posterior tiene éxito', async () => {
    let n = 0;
    const factory = () => {
      n++;
      return n < 3 ? Promise.reject(new Error('chunk obsoleto')) : Promise.resolve('ok');
    };
    await expect(importWithRetry(factory, 2, 0)).resolves.toBe('ok');
    expect(n).toBe(3);
  });

  it('agota los reintentos y propaga el último error', async () => {
    const factory = vi.fn().mockRejectedValue(new Error('falló'));
    await expect(importWithRetry(factory, 2, 0)).rejects.toThrow('falló');
    expect(factory).toHaveBeenCalledTimes(3); // 1 intento + 2 reintentos
  });
});
