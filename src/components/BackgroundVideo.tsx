'use client';

import React, { useState } from 'react';

export default function BackgroundVideo() {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="fixed inset-0 bg-[#000000] overflow-hidden pointer-events-none z-0">
      {!hasError && (
        <video
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setHasError(true)}
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
      )}
    </div>
  );
}
