import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-neutral-50 dark:bg-neutral-900 text-center">
          <h2 className="text-2xl font-black text-neutral-800 dark:text-white mb-4">Something went wrong.</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">The application encountered a critical error. Please refresh the page.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-xl"
          >
            Refresh Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
