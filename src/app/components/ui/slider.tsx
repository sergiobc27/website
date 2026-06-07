import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

// Slider de rango (soporta múltiples thumbs vía value array). Sin dependencia
// de tailwind-merge/clsx: las clases son fijas + un className opcional.
function Slider({
  className = '',
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max]
  );

  return (
    <SliderPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={`relative flex w-full touch-none items-center select-none ${className}`}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      {Array.from({ length: values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block size-4 shrink-0 rounded-full border border-accent bg-background shadow-sm transition-shadow hover:ring-4 hover:ring-accent/30 focus-visible:ring-4 focus-visible:ring-accent/40 focus-visible:outline-none"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
