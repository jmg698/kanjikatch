"use client";

/**
 * Pastel buttercup background for the mid-session reading interlude.
 * Same fullscreen role as StaticShinkansenBackground — soft warm gradient
 * meant to read as "morning sun on paper", not saturated yellow.
 *
 * Crossfaded over the shinkansen background by the parent so the user
 * perceives a quiet shift in light, not a navigation.
 */
export function InterludeBackground() {
  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden
      style={{
        background:
          "linear-gradient(180deg, #FBF3D9 0%, #F7EAC8 55%, #F3DDB0 100%)",
      }}
    >
      {/* Soft warm vignette to give the panel a centered glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255, 244, 214, 0.55) 0%, rgba(243, 221, 176, 0) 60%)",
        }}
      />
    </div>
  );
}
