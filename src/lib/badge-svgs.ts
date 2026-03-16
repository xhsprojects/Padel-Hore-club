// This file maps badge IDs to their SVG path data for canvas rendering.
// fill: 'currentColor' is for filled icons, fill: 'none' is for stroked icons.
export const BADGE_SVGS: Record<string, { path: string, fill: string }> = {
  'podium-1': { path: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>', fill: 'none' },
  'podium-2': { path: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>', fill: 'none' },
  'podium-3': { path: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>', fill: 'none' },
  'giant-killer': { path: '<path d="m15.5 13.5 5-5a1 1 0 0 0-1.4-1.4l-5 5"/><path d="m18 16 2-2"/><path d="m13.5 8.5-5-5a1 1 0 0 0-1.4 1.4l5 5"/><path d="m16 6 2-2"/><path d="M9 13v3a1 1 0 0 0 1 1h1"/><path d="M5 17v3a1 1 0 0 0 1 1h1"/>', fill: 'none' },
  'unstoppable': { path: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>', fill: 'none' },
  'the-wall': { path: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>', fill: 'none' },
  'early-bird': { path: '<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6-6 6h12l-6-6z"/>', fill: 'none' },
  'night-owl': { path: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', fill: 'none' },
  'marathoner': { path: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/><path d="m3 14 3-3h3l3 3h4"/>', fill: 'none' },
  'socialite': { path: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', fill: 'none' },
  'fair-play': { path: '<path d="m12 3-1.9 4.8-4.8 1.9 4.8 1.9L12 16l1.9-4.8 4.8-1.9-4.8-1.9L12 3z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>', fill: 'none' },
  'pioneer': { path: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.3.09-3.1a2 2 0 0 0-2.43-2.43c-.8.61-2.26.72-3.1.1z"/><path d="m12 15-3-3a2.4 2.4 0 0 1 0-3.46l3-3a2.4 2.4 0 0 1 3.46 0l3 3a2.4 2.4 0 0 1 0 3.46l-3 3a2.4 2.4 0 0 1-3.46 0Z"/>', fill: 'none' },
  'hat-trick': { path: '<path d="M7.21 15 2.66 7.14a1 1 0 0 1 .13-1.28L4.6 4.4a1 1 0 0 1 1.28-.12L12 9l6.12-4.72a1 1 0 0 1 1.28.12l1.81 1.46a1 1 0 0 1 .13 1.28L16.79 15"/><path d="M12 15h0"/><path d="M4.26 10h15.48"/><path d="M12 15v7"/><path d="M8.5 19c0-1.5 1.5-3 3.5-3s3.5 1.5 3.5 3c0 1.5-1.5 3-3.5 3s-3.5-1.5-3.5-3z"/>', fill: 'none' },
  'holiday-hero': { path: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>', fill: 'none' },
  'event-enthusiast': { path: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>', fill: 'none' },
};
