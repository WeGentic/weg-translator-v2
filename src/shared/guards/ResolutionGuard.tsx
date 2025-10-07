import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

interface ViewportSize {
  width: number;
  height: number;
}

function useViewport(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
  }));

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

interface ResolutionGuardProps {
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
}

export function ResolutionGuard({
  children,
  minWidth = 768,
  minHeight = 600,
}: ResolutionGuardProps) {
  const { width, height } = useViewport();
  const isBlocked = width < minWidth || height < minHeight;

  if (!isBlocked) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-3xl">
        <div className="flex h-full items-center justify-center p-4">
          <Card className="max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <svg
                  className="h-6 w-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <CardTitle className="text-xl">Screen Resolution Too Small</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                This application requires a minimum screen resolution to function properly.
              </p>
              <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span>Current:</span>
                  <span className="font-mono">
                    {width} × {height}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Required:</span>
                  <span className="font-mono">
                    {minWidth} × {minHeight}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Please resize your window or use a device with a larger screen.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <div aria-hidden="true" className="pointer-events-none relative z-0">
        {children}
      </div>
    </>
  );
}
