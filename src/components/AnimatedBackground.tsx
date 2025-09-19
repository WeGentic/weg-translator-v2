export function AnimatedBackground() {
  return (
    <div className="animated-background">
      {/* Base mesh gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/15 to-accent/20" />

      {/* Animated gradient layers */}
      <div className="gradient-layer gradient-layer-1" />
      <div className="gradient-layer gradient-layer-2" />
      <div className="gradient-layer gradient-layer-3" />

      {/* Floating orbs */}
      <div className="floating-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
    </div>
  );
}