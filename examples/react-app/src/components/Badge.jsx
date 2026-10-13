// Badge: tone 'neutral' | 'success' | 'warning'.
export function Badge({ tone = 'neutral', children, ...props }) {
  return <span className={tone === 'neutral' ? 'badge' : `badge badge--${tone}`} {...props}>{children}</span>;
}
