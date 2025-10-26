import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Monitor } from "lucide-react";

import "./css/resolution-guard.css";

interface ViewportSize {
  width: number;
  height: number;
}

type ResolutionMetricStyle = CSSProperties & {
  "--rg-progress"?: string;
};

function useViewport(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
  }));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

interface ResolutionGuardProps {
  children: ReactNode;
  minWidth?: number;
  minHeight?: number;
}

export function ResolutionGuard({
  children,
  minWidth = 768,
  minHeight = 600,
}: ResolutionGuardProps) {
  const { width, height } = useViewport();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const isBlocked = width < minWidth || height < minHeight;
  const widthShortfall = Math.max(0, minWidth - width);
  const heightShortfall = Math.max(0, minHeight - height);

  useEffect(() => {
    if (!isBlocked) return;
    panelRef.current?.focus();
  }, [isBlocked, width, height]);

  if (!isBlocked) {
    return <>{children}</>;
  }

  const requirements = [
    { label: "Width", current: width, required: minWidth, shortfall: widthShortfall },
    { label: "Height", current: height, required: minHeight, shortfall: heightShortfall },
  ];

  return (
    <div className="resolution-guard">
      <section
        className="resolution-guard__overlay"
        aria-live="assertive"
        aria-atomic="true"
      >
        <article
          ref={panelRef}
          className="resolution-guard__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
        >
          <header className="resolution-guard__header">
            <span aria-hidden="true" className="resolution-guard__icon">
              <Monitor className="resolution-guard__icon-glyph" />
            </span>
            <div className="resolution-guard__intro">
              <h2 id={titleId} className="resolution-guard__title">
                Give us a little more space
              </h2>
              <p id={descriptionId} className="resolution-guard__subtitle">
                Tr-entic works best on larger viewports. Grow the window or connect to a bigger
                display to unlock the full workspace.
              </p>
            </div>
          </header>

          <ul className="resolution-guard__metrics">
            {requirements.map(({ label, current, required, shortfall }) => {
              const progress =
                required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 100;
              const metricStyle: ResolutionMetricStyle = {
                "--rg-progress": `${progress}%`,
              };
              const status = shortfall > 0 ? "alert" : "ok";

              return (
                <li key={label} className="resolution-guard__metric" data-state={status}>
                  <div className="resolution-guard__metric-header">
                    <span className="resolution-guard__metric-label">{label}</span>
                    <span className="resolution-guard__metric-value">{current}px</span>
                  </div>
                  <div
                    className="resolution-guard__metric-bar"
                    role="presentation"
                    style={metricStyle}
                  >
                    <span aria-hidden="true" className="resolution-guard__metric-bar-fill" />
                  </div>
                  <p className="resolution-guard__metric-caption">
                    {shortfall > 0
                      ? `Add ${shortfall}px to reach ${required}px`
                      : `Meets the ${required}px requirement`}
                  </p>
                </li>
              );
            })}
          </ul>
        </article>
      </section>
      <div aria-hidden="true" className="resolution-guard__content">
        {children}
      </div>
    </div>
  );
}
