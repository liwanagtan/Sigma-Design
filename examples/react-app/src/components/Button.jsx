// Button: variant 'primary' | 'secondary' | 'danger'.
export function Button({ variant = 'primary', disabled = false, children, ...props }) {
  return (
    <button className={variant === 'primary' ? 'button' : `button button--${variant}`} disabled={disabled} {...props}>
      <span data-sigma-name="Label">{children}</span>
    </button>
  );
}
