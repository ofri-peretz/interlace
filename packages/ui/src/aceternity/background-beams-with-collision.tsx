"use client";

/**
 * @interlace/ui — BackgroundBeamsWithCollision
 *
 * A hero surface where thin vertical beams fall from the top and burst into a
 * ten-particle explosion when they reach the strip along the bottom. Your
 * children render above them on a `z-10` layer.
 *
 * The container is `h-96 md:h-[40rem]` unless `containerClassName` says
 * otherwise.
 *
 * Our reimplementation of the Aceternity UI effect of the same name. What is
 * ours: the beams are painted from `--primary` / `--chart-2` rather than the
 * upstream purple/indigo literals, so they re-resolve per theme; an
 * `IntersectionObserver` unmounts the whole beam layer when the hero scrolls
 * out of view; the collision poll runs at 200ms instead of 50ms; and the
 * explosion is ten particles instead of twenty.
 *
 * ## Anatomy
 *
 *   div                              (parent — gradient, overflow-hidden,
 *                                     contain: layout style paint)
 *     ├─ CollisionMechanism ×beams   (motion.div beam + AnimatePresence)
 *     │   └─ Explosion               (glow line + 10 motion.span particles)
 *     ├─ div.z-10                    (your children)
 *     └─ div                         (collision surface, bottom strip —
 *                                     styling suppressed by hideCollisionSurface)
 *
 * Each beam is a `BeamConfig` (`initialX`, `translateY`, `duration`, `delay`,
 * `repeatDelay`, `className`); `beams` replaces the seven-beam default wholesale.
 *
 * ## Motion
 *
 * JS-driven throughout — `motion/react` transforms for the fall, a
 * `setInterval` collision poll, and `AnimatePresence` for the burst. None of
 * it is reachable by the CSS reset in `styles/preflight.css`, so the gate is
 * in JS and it is total: `{isVisible && !reduceMotion && beams.map(…)}` means
 * that under `prefers-reduced-motion: reduce` no `CollisionMechanism` mounts
 * at all — no beams, no interval, no explosions. What remains is the gradient
 * background, the collision strip, and your content. That is the intended
 * still state, not a degraded one.
 *
 * ## Where it leaves the token system
 *
 * The beams and the explosion are tokenised, but the surface around them is
 * not: the parent gradient is `from-white to-neutral-100` /
 * `dark:from-neutral-950 … dark:to-neutral-900`, the collision strip is
 * `bg-neutral-100` / `dark:bg-neutral-900/50`, and its `boxShadow` is a stack
 * of raw `rgba()` literals. Pass `containerClassName` to put the surface back
 * on your own background.
 *
 * The explosion's particle directions come from `Math.random()`, so no two
 * bursts match and the effect is not snapshot-testable.
 */

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";
import { motion, AnimatePresence } from "motion/react";
import React, { useRef, useState, useEffect } from "react";

// =========================================
// TYPES
// =========================================

export interface BeamConfig {
  initialX?: number;
  translateX?: number;
  initialY?: number;
  translateY?: number;
  rotate?: number;
  className?: string;
  duration?: number;
  delay?: number;
  repeatDelay?: number;
}

export interface BackgroundBeamsWithCollisionProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  beams?: BeamConfig[];
  /** When true, hides the visible collision surface at the bottom (useful for full-page backgrounds) */
  hideCollisionSurface?: boolean;
}

interface CollisionState {
  detected: boolean;
  coordinates: { x: number; y: number } | null;
}

// =========================================
// CONFIGURATION - Beam Definitions
// =========================================

/**
 * Default beam configuration - staggered across the viewport
 * Each beam has unique timing and position for visual variety
 */
const DEFAULT_BEAMS: BeamConfig[] = [
  { initialX: 10, translateX: 10, duration: 7, repeatDelay: 3, delay: 2 },
  { initialX: 600, translateX: 600, duration: 3, repeatDelay: 3, delay: 4 },
  { initialX: 100, translateX: 100, duration: 7, repeatDelay: 7, className: "h-6" },
  { initialX: 400, translateX: 400, duration: 5, repeatDelay: 14, delay: 4 },
  { initialX: 800, translateX: 800, duration: 11, repeatDelay: 2, className: "h-20" },
  { initialX: 1000, translateX: 1000, duration: 4, repeatDelay: 2, className: "h-12" },
  { initialX: 1200, translateX: 1200, duration: 6, repeatDelay: 4, delay: 2, className: "h-6" },
];

// =========================================
// MAIN COMPONENT
// =========================================

export const BackgroundBeamsWithCollision = ({
  children,
  className,
  containerClassName,
  beams = DEFAULT_BEAMS,
  hideCollisionSurface = false,
}: BackgroundBeamsWithCollisionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const reduceMotion = useReducedMotion();

  // Pause animations when component is not visible (performance optimization)
  useEffect(() => {
    if (!parentRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={parentRef}
      className={cn(
        // Base layout
        "relative flex w-full items-center justify-center overflow-hidden",
        // Default height (can be overridden via className)
        "h-96 md:h-[40rem]",
        // Theme-aware background gradient
        // Light mode: Clean white to neutral gradient
        "bg-gradient-to-b from-white to-neutral-100",
        // Dark mode: a warm brand wash, not the inherited purple
        "dark:from-neutral-950 dark:via-primary/8 dark:to-neutral-900",
        containerClassName
      )}
      // Performance: CSS containment to reduce layout thrashing
      style={{ contain: 'layout style paint' }}
    >
      {/* Render collision beams — gated on visibility AND reduced-motion. */}
      {isVisible && !reduceMotion && beams.map((beam) => (
        <CollisionMechanism
          key={`${beam.initialX}-beam`}
          beamOptions={beam}
          containerRef={containerRef}
          parentRef={parentRef}
        />
      ))}

      {/* Content wrapper */}
      <div className={cn("relative z-10", className)}>{children}</div>

      {/* Collision surface at bottom */}
      <div
        ref={containerRef}
        className={cn(
          "absolute bottom-0 inset-x-0 w-full pointer-events-none",
          // Only show visual styling when not hidden
          !hideCollisionSurface && [
            // Light mode: Subtle neutral with soft shadow
            "bg-neutral-100",
            // Dark mode: Darker surface with purple tint
            "dark:bg-neutral-900/50"
          ]
        )}
        style={hideCollisionSurface ? undefined : {
          boxShadow:
            "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset",
        }}
      />
    </div>
  );
};

// =========================================
// COLLISION MECHANISM
// =========================================

const CollisionMechanism = React.forwardRef<
  HTMLDivElement,
  {
    containerRef: React.RefObject<HTMLDivElement | null>;
    parentRef: React.RefObject<HTMLDivElement | null>;
    beamOptions?: BeamConfig;
  }
>(({ parentRef, containerRef, beamOptions = {} as BeamConfig }, _ref) => {
  const beamRef = useRef<HTMLDivElement>(null);
  const [collision, setCollision] = useState<CollisionState>({
    detected: false,
    coordinates: null,
  });
  const [beamKey, setBeamKey] = useState(0);
  const [cycleCollisionDetected, setCycleCollisionDetected] = useState(false);

  // Collision detection loop
  useEffect(() => {
    const checkCollision = () => {
      if (
        beamRef.current &&
        containerRef.current &&
        parentRef.current &&
        !cycleCollisionDetected
      ) {
        const beamRect = beamRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const parentRect = parentRef.current.getBoundingClientRect();

        // Detect when beam hits the container surface
        if (beamRect.bottom >= containerRect.top) {
          const relativeX =
            beamRect.left - parentRect.left + beamRect.width / 2;
          const relativeY = beamRect.bottom - parentRect.top;

          setCollision({
            detected: true,
            coordinates: { x: relativeX, y: relativeY },
          });
          setCycleCollisionDetected(true);
        }
      }
    };

    // Performance: Reduced from 50ms to 200ms (75% less CPU usage)
    const animationInterval = setInterval(checkCollision, 200);
    return () => clearInterval(animationInterval);
  }, [cycleCollisionDetected, containerRef, parentRef]);

  // Reset collision after explosion animation
  useEffect(() => {
    if (collision.detected && collision.coordinates) {
      const explosionDuration = 2000;

      setTimeout(() => {
        setCollision({ detected: false, coordinates: null });
        setCycleCollisionDetected(false);
      }, explosionDuration);

      setTimeout(() => {
        setBeamKey((prevKey) => prevKey + 1);
      }, explosionDuration);
    }
  }, [collision]);

  return (
    <>
      {/* Animated beam */}
      <motion.div
        key={beamKey}
        ref={beamRef}
        animate="animate"
        initial={{
          translateY: beamOptions.initialY || "-200px",
          translateX: beamOptions.initialX || "0px",
          rotate: beamOptions.rotate || 0,
        }}
        variants={{
          animate: {
            translateY: beamOptions.translateY || "1800px",
            translateX: beamOptions.translateX || "0px",
            rotate: beamOptions.rotate || 0,
          },
        }}
        transition={{
          duration: beamOptions.duration || 8,
          repeat: Infinity,
          repeatType: "loop",
          ease: "linear",
          delay: beamOptions.delay || 0,
          repeatDelay: beamOptions.repeatDelay || 0,
        }}
        className={cn(
          // Base beam styling
          "absolute left-0 top-20 m-auto h-14 w-px rounded-full",
          // Brand beam. No dark: variant — the tokens resolve per theme.
          "bg-gradient-to-t from-primary via-chart-2 to-transparent",
                    beamOptions.className
        )}
      />

      {/* Explosion effect on collision */}
      <AnimatePresence>
        {collision.detected && collision.coordinates && (
          <Explosion
            key={`${collision.coordinates.x}-${collision.coordinates.y}`}
            style={{
              left: `${collision.coordinates.x}px`,
              top: `${collision.coordinates.y}px`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
});

CollisionMechanism.displayName = "CollisionMechanism";

// =========================================
// EXPLOSION EFFECT
// =========================================

/**
 * Particle explosion animation that triggers on beam collision
 * Performance: Reduced from 20 to 10 particles for 50% less motion overhead
 */
const Explosion = ({ ...props }: React.HTMLProps<HTMLDivElement>) => {
  // Generate particles with random directions using lazy state initializer
  // This ensures random values are only generated once on mount, not during render
  const [spans] = React.useState(() =>
    Array.from({ length: 10 }, (_, index) => ({
      id: index,
      initialX: 0,
      initialY: 0,
      directionX: Math.floor(Math.random() * 80 - 40),
      directionY: Math.floor(Math.random() * -50 - 10),
      duration: Math.random() * 1.5 + 0.5,
    }))
  );

  return (
    <div {...props} className={cn("absolute z-50 h-2 w-2", props.className)}>
      {/* Horizontal glow line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className={cn(
          "absolute -inset-x-10 top-0 m-auto h-2 w-10 rounded-full blur-sm",
          // Brand glow
          "bg-gradient-to-r from-transparent via-primary to-transparent"
        )}
      />

      {/* Scattered particles */}
      {spans.map((span) => (
        <motion.span
          key={span.id}
          initial={{ x: span.initialX, y: span.initialY, opacity: 1 }}
          animate={{
            x: span.directionX,
            y: span.directionY,
            opacity: 0,
          }}
          transition={{
            duration: span.duration,
            ease: "easeOut",
          }}
          className={cn(
            "absolute h-1 w-1 rounded-full",
            // Brand particles
            "bg-gradient-to-b from-primary to-chart-2"
          )}
        />
      ))}
    </div>
  );
};

export default BackgroundBeamsWithCollision;
