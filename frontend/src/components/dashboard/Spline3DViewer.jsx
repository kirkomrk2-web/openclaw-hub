import React, { Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Box, Loader2, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';

// Lazy load Spline to improve initial page load
const Spline = React.lazy(() => import('@splinetool/react-spline'));

// Default robot scene from Spline community
const DEFAULT_SCENE_URL = 'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode';

// Alternative scenes you can use:
// Robot: https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode
// Keyboard: https://prod.spline.design/kZDR10VZhMDmLJHf/scene.splinecode
// Abstract: https://prod.spline.design/Cq2KNsVD-4FVRXtI/scene.splinecode

const LoadingFallback = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/30 rounded-lg">
    <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
    <span className="text-sm text-muted-foreground">Loading 3D Model...</span>
  </div>
);

const ErrorFallback = ({ onRetry }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/30 rounded-lg">
    <Box className="w-12 h-12 text-muted-foreground mb-3" />
    <span className="text-sm text-muted-foreground mb-2">Failed to load 3D model</span>
    <Button variant="outline" size="sm" onClick={onRetry}>
      <RotateCcw className="w-4 h-4 mr-1" />
      Retry
    </Button>
  </div>
);

export default function Spline3DViewer({
  sceneUrl = DEFAULT_SCENE_URL,
  title = "3D Mascot",
  height = "300px",
  showControls = true,
  className = ""
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [key, setKey] = useState(0);

  const handleError = () => {
    setHasError(true);
  };

  const handleRetry = () => {
    setHasError(false);
    setKey(prev => prev + 1);
  };

  const handleLoad = (spline) => {
    // You can access Spline API here
    // Example: spline.setVariable('status', 'online');
    console.log('Spline scene loaded:', spline);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
      className={className}
    >
      <GlassCard>
        <GlassCardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Box className="w-5 h-5 text-accent" />
              {title}
            </h3>
            {showControls && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleRetry}
                  title="Reload model"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? "Minimize" : "Expand"}
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* 3D Viewer */}
          <div
            className="relative rounded-lg overflow-hidden bg-gradient-to-br from-secondary/50 to-secondary/20 border border-border/30"
            style={{ height: isExpanded ? '500px' : height }}
          >
            {hasError ? (
              <ErrorFallback onRetry={handleRetry} />
            ) : (
              <Suspense fallback={<LoadingFallback />}>
                <Spline
                  key={key}
                  scene={sceneUrl}
                  onLoad={handleLoad}
                  onError={handleError}
                  style={{ width: '100%', height: '100%' }}
                />
              </Suspense>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-2 text-xs text-muted-foreground text-center">
            Drag to rotate • Scroll to zoom • Right-click to pan
          </div>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}

// Export scene URLs for easy access
export const SPLINE_SCENES = {
  robot: 'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode',
  keyboard: 'https://prod.spline.design/kZDR10VZhMDmLJHf/scene.splinecode',
  abstract: 'https://prod.spline.design/Cq2KNsVD-4FVRXtI/scene.splinecode',
  // Add your custom Spline scenes here:
  // custom: 'https://prod.spline.design/YOUR-ID/scene.splinecode',
};
