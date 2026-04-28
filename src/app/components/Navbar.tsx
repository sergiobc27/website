import { Sun, Moon, HelpCircle, User, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface NavbarProps {
  breadcrumbs: string[];
}

export function Navbar({ breadcrumbs }: NavbarProps) {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="h-16 bg-card border-b border-border px-6 flex items-center justify-between backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="w-4 h-4 text-[#CCCCCC]" />}
            <span className={`transition-colors ${index === breadcrumbs.length - 1 ? 'text-accent font-semibold' : 'text-muted-foreground hover:text-foreground cursor-pointer'}`}>
              {crumb}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-accent transition-all hover:scale-110"
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-accent transition-all hover:scale-110" title="Ayuda">
          <HelpCircle className="w-5 h-5" />
        </button>

        <div className="w-8 h-8 bg-gradient-to-br from-[#A3161A] to-[#C9A227] rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-[0_0_15px_rgba(201,162,39,0.3)] hover:shadow-[0_0_25px_rgba(201,162,39,0.5)]">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}
