import { Button } from './Button.jsx';

// Card: a title, a body and an action.
export function Card({ title, children, action = 'Open', ...props }) {
  return (
    <section className="card" {...props}>
      <h2 className="card__title" data-sigma-name="Title">{title}</h2>
      <p className="card__body" data-sigma-name="Body">{children}</p>
      <Button data-sigma-name="Button">{action}</Button>
    </section>
  );
}
