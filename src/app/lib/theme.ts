export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ideam-theme';

export function getThemeChoice(): ThemeChoice {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'system';
  return v === 'light' || v === 'dark' ? v : 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveIsDark(choice: ThemeChoice): boolean {
  if (choice === 'dark') return true;
  if (choice === 'light') return false;
  return systemPrefersDark();
}

export function applyTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* almacenamiento no disponible: aplica igual el tema en memoria */
  }
  document.documentElement.classList.toggle('dark', resolveIsDark(choice));
}

// Aplica el tema guardado y, si es 'system', escucha cambios del SO.
// Devuelve una función de limpieza. Llamar una vez al montar App.
export function initTheme(): () => void {
  applyTheme(getThemeChoice());
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getThemeChoice() === 'system') {
      document.documentElement.classList.toggle('dark', mq.matches);
    }
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
