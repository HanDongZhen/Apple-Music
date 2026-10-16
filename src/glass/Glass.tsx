import { useRef, type CSSProperties, type HTMLAttributes } from 'react';

export type GlassMaterial =
  | 'ultrathin'
  | 'thin'
  | 'regular'
  | 'thick'
  | 'navigation'
  | 'tabbar'
  | 'player'
  | 'mini-player'
  | 'control'
  | 'menu'
  | 'popover'
  | 'modal'
  | 'bottom-sheet'
  | 'search'
  | 'queue'
  | 'lyrics-control';
export function Glass({
  material = 'regular',
  children,
  className = '',
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { material?: GlassMaterial }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`glass glass--${material} ${className}`}
      style={style as CSSProperties}
      onPointerMove={(event) => {
        if (document.documentElement.dataset.quality === 'reduced' || event.pointerType === 'touch')
          return;
        const bounds = event.currentTarget.getBoundingClientRect();
        ref.current?.style.setProperty(
          '--pointer-x',
          `${((event.clientX - bounds.left) / bounds.width) * 100}%`,
        );
        ref.current?.style.setProperty(
          '--pointer-y',
          `${((event.clientY - bounds.top) / bounds.height) * 100}%`,
        );
      }}
      {...props}
    >
      {children}
    </div>
  );
}
export function GlassFilters() {
  return (
    <svg className="filter-definitions" aria-hidden="true">
      <defs>
        <filter id="glass-refraction" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.018"
            numOctaves="1"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
