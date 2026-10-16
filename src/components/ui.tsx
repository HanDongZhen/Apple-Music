import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X, Music2 } from 'lucide-react';
import { Glass } from '../glass/Glass';
import { spring } from '../motion/tokens';

export function IconButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button ${className}`}
      onPointerUp={(event) => {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
          event.currentTarget.animate(
            [
              { transform: 'scale(.97)' },
              { transform: 'scale(1.008)', offset: 0.7 },
              { transform: 'scale(1)' },
            ],
            { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' },
          );
      }}
      {...props}
    >
      {children}
    </button>
  );
}
export function Artwork({
  src,
  alt,
  layoutId,
  className = '',
}: {
  src?: string;
  alt: string;
  layoutId?: string;
  className?: string;
}) {
  return (
    <motion.img
      layoutId={layoutId}
      transition={spring.player}
      className={`artwork ${className}`}
      src={src || '/artwork/placeholder.svg'}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/artwork/placeholder.svg'))
          event.currentTarget.src = '/artwork/placeholder.svg';
      }}
    />
  );
}
export function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();
    const handler = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[data-dialog]');
      if (dialogs[dialogs.length - 1] !== node) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === 'Tab') {
        const elements = [
          ...(node?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]',
          ) || []),
        ].filter((el) => el.getClientRects().length);
        if (!elements.length) {
          event.preventDefault();
          return;
        }
        const first = elements[0],
          last = elements.at(-1)!;
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === node)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <motion.div
      className={`modal-layer ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        className="modal-backdrop"
        aria-label={`Close ${title}`}
        onClick={onClose}
        tabIndex={-1}
      />
      <motion.div
        ref={ref}
        className="dialog-wrap"
        data-dialog
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        initial={{ y: 24, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, scale: 0.98 }}
        transition={spring.sheet}
      >
        <Glass material="modal" className="dialog">
          <div className="dialog-heading">
            <h2>{title}</h2>
            <IconButton label={`Close ${title}`} onClick={onClose}>
              <X size={20} />
            </IconButton>
          </div>
          {children}
        </Glass>
      </motion.div>
    </motion.div>
  );
}
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Music2 size={32} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
