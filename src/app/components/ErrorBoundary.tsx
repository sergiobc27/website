import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Error boundary del shell. Evita que un fallo al renderizar o al cargar un
// chunk lazy (red interrumpida) tumbe toda la SPA a pantalla en blanco: en su
// lugar muestra un fallback con reintento, conservando sidebar y navbar.
// Debe ser componente de clase (React no expone boundaries en hooks).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary capturó un error:', error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-primary" />
          <div>
            <h2 className="text-card-foreground text-lg font-bold">No se pudo cargar esta vista</h2>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm">
              Puede deberse a una conexión interrumpida. Reintenta o recarga la página.
            </p>
          </div>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_24px] hover:shadow-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RotateCcw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
