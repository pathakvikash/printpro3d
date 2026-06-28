'use client';

import { useEffect, useState, Component, ReactNode } from 'react';
import { Canvas, CanvasProps } from '@react-three/fiber';

function useWebGLSupport() {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      const gl =
        c.getContext('webgl2') ||
        c.getContext('webgl') ||
        c.getContext('experimental-webgl');
      if (!gl) setSupported(false);
    } catch {
      setSupported(false);
    }
  }, []);

  return supported;
}

class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const isWebGLError =
      error.message?.includes('WebGL') ||
      error.message?.includes('context') ||
      error.message?.includes('createContext');
    if (!isWebGLError) console.error('Canvas error:', error);
    this.setState({ hasError: true });
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function Fallback3D({ children }: { children?: ReactNode }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950">
      {children || (
        <div className="text-center px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76a1 1 0 000 1.4z" />
            </svg>
          </div>
          <p className="text-gray-300 font-medium">3D preview unavailable</p>
          <p className="text-gray-500 text-sm mt-1">Your browser does not support WebGL.</p>
          <p className="text-gray-600 text-xs mt-3">
            Try using a different browser or enable WebGL in your browser settings.
          </p>
        </div>
      )}
    </div>
  );
}

export function SafeCanvas({ children, fallback, ...props }: CanvasProps & { fallback?: ReactNode }) {
  const supported = useWebGLSupport();

  if (!supported) {
    return <Fallback3D>{fallback}</Fallback3D>;
  }

  return (
    <CanvasErrorBoundary fallback={fallback || <Fallback3D />}>
      <Canvas {...props}>{children}</Canvas>
    </CanvasErrorBoundary>
  );
}

export default SafeCanvas;
