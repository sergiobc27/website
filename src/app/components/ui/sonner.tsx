import { useEffect, useState } from "react";
import { Toaster as Sonner, ToasterProps } from "sonner";

// El tema lo gestiona src/app/lib/theme.ts vía la clase `dark` en <html>.
// Observamos esa clase para que el Toaster siga el tema en caliente, sin
// depender de next-themes.
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(target.classList.contains("dark")));
    observer.observe(target, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const isDark = useIsDark();

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
