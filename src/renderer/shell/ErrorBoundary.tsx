import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Last line of defence: a render-time throw anywhere below here used to blank
 *  the whole window (React unmounts the tree, and there's no host chrome behind
 *  it). Catch it, show what happened, and offer a reload. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mb-crash">
        <h2>Something went wrong drawing the screen</h2>
        <p>
          The editor hit an error and stopped rendering. Your project on disk is untouched — reload to
          get back to it.
        </p>
        <pre>{String(error.stack || error.message || error)}</pre>
        <button onClick={() => window.location.reload()}>Reload the editor</button>
      </div>
    );
  }
}
