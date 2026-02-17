import React from 'react';

/**
 * Ambient Floating Orbs - creates smooth gradient circles with slow animations
 * that float in the background for a liquid glass effect
 */
export const AmbientOrbs = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Primary blue orb - top left */}
      <div
        className="orb orb-1"
        style={{ top: '-10%', left: '-10%' }}
      />
      {/* Purple orb - bottom right */}
      <div
        className="orb orb-2"
        style={{ bottom: '-5%', right: '-5%' }}
      />
      {/* Cyan accent orb - center right */}
      <div
        className="orb orb-3"
        style={{ top: '40%', right: '10%' }}
      />
    </div>
  );
};

export default AmbientOrbs;
