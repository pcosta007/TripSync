'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    // Only register in production and if supported
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const swUrl = '/sw.js';
    navigator.serviceWorker
      .register(swUrl)
      .catch((err) => console.warn('SW register failed', err));

    // no cleanup needed
  }, []);

  return null;
}