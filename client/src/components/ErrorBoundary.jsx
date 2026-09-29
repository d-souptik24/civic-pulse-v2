import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Platform Error Boundary
 * Prevents full-page white screens if a child component throws an unhandled error.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CivicPulse uncaught error boundary catch:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen pt-24 px-4 flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-stone-paper)' }}
        >
          <div
            className="max-w-md w-full p-8 rounded-2xl border text-center shadow-lg animate-fade-in"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: 'var(--color-stone-line)',
            }}
          >
            <div
              className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-5"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2 className="text-xl font-bold font-serif mb-2" style={{ color: 'var(--color-ink)' }}>
              Something went wrong
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-fog)' }}>
              An unexpected error occurred while loading this view. You can reload the page or return to the dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary flex items-center justify-center gap-2 text-xs py-2.5 px-4"
              >
                <RefreshCw size={14} />
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="btn-primary flex items-center justify-center gap-2 text-xs py-2.5 px-4"
              >
                <Home size={14} />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
