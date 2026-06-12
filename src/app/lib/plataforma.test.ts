import { describe, expect, it } from 'vitest';
import { detectarPlataforma } from './plataforma';

const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IPAD_CAMUFLADO = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const UA_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

describe('detectarPlataforma', () => {
  it('iPhone -> ios', () => {
    expect(detectarPlataforma(UA_IPHONE, 5)).toBe('ios');
  });
  it('iPad camuflado de Mac (touch) -> ios; Mac real (sin touch) -> desktop', () => {
    expect(detectarPlataforma(UA_IPAD_CAMUFLADO, 5)).toBe('ios');
    expect(detectarPlataforma(UA_IPAD_CAMUFLADO, 0)).toBe('desktop');
  });
  it('Android -> android', () => {
    expect(detectarPlataforma(UA_ANDROID, 5)).toBe('android');
  });
  it('Windows -> desktop', () => {
    expect(detectarPlataforma(UA_WINDOWS, 0)).toBe('desktop');
  });
});
