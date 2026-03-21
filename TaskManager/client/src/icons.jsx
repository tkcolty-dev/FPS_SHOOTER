import React from 'react';

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconDashboard = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
);

export const IconTasks = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
);

export const IconCalendar = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
);

export const IconChat = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
);

export const IconProfile = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

export const IconPlus = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
);

export const IconBell = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
);

export const IconSend = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
);

export const IconTrash = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
);

export const IconEdit = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);

export const IconCheck = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polyline points="20 6 9 17 4 12"/></svg>
);

export const IconChevronDown = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s} strokeWidth={2.5}><polyline points="6 9 12 15 18 9"/></svg>
);

export const IconChevronLeft = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polyline points="15 18 9 12 15 6"/></svg>
);

export const IconChevronRight = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polyline points="9 18 15 12 9 6"/></svg>
);

export const IconSettings = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
);

export const IconSun = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>
);

export const IconMoon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
);

export const IconLock = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
);

export const IconLogOut = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);

export const IconClock = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export const IconStar = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
);

export const IconMail = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 7 12 13 2 7"/></svg>
);

export const IconClipboard = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="4" y="4" width="16" height="18" rx="2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
);

export const IconTarget = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);

export const IconMapPin = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
);

export const IconUsers = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
);

export const IconCopy = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
);

export const IconX = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
);

export const IconAlertCircle = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);

export const IconZap = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);

// Time-of-day icons
export const IconSunrise = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M17 18a5 5 0 00-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/></svg>
);

export const IconSunHigh = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M5.64 5.64l1.41 1.41"/><path d="M16.95 16.95l1.41 1.41"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M5.64 18.36l1.41-1.41"/><path d="M16.95 7.05l1.41-1.41"/></svg>
);

export const IconSunset = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M17 18a5 5 0 00-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="16 5 12 9 8 5"/></svg>
);

export const IconMoonStars = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/><path d="M17 4l0 4"/><path d="M15 6l4 0"/></svg>
);

export const IconMoonFull = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 000 20"/></svg>
);

export const IconChevronUp = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s} strokeWidth={2.5}><polyline points="18 15 12 9 6 15"/></svg>
);

export const IconSearch = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);

export const IconRepeat = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
);

export const IconTemplate = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
);

export const IconLink = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
);

export const IconExternalLink = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
);

export const IconPin = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 17v5"/><path d="M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6a1 1 0 011-1h.5a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5H8a1 1 0 011 1z"/></svg>
);

export const IconPlay = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
);

export const IconPause = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
);

export const IconSkipForward = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
);

export const IconGripVertical = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
);

export const IconRotateCcw = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
);

export const IconMic = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);

export const IconMicOff = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);
