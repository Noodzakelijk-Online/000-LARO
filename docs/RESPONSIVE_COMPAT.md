# Responsive and Browser Compatibility

Date: 2026-07-17

## Target runtime

LARO's primary renderer runs in the Chromium version bundled with Electron 43.
The packaged desktop app is therefore the supported browser target. A separately
hosted build would require its own evergreen-browser matrix.

## Responsive implementation

- Tailwind breakpoints and flex/grid layouts reflow the application shell and
  route content.
- Radix UI primitives provide responsive dialog, popover, dropdown, tab, select,
  and scroll-area behavior.
- The sidebar switches to a mobile trigger and the primary content retains a
  constrained, non-overlapping work area.
- Fixed assistant and notification surfaces use viewport-relative widths and
  heights on narrow screens.

## Verified matrix

The final portable Windows executable was audited at 1440x900 and 390x844 on all
14 mounted routes:

`/`, `/cases`, `/lawyers`, `/outreach`, `/help`, `/settings`,
`/email-settings`, `/email-preferences`, `/privacy`, `/admin`,
`/admin-analytics`, `/messages`, `/email`, and `/analytics`.

All 28 route/viewport combinations had meaningful content, no horizontal page
overflow, and no blank or framework-error surface. The mobile Cases header,
assistant panel, notification popover, Help accordion, and Case Notes compose
flow were additionally exercised. The assistant measured 366x820 inside the
390x844 viewport.

## Remaining scope

- Electron's bundled Chromium is verified; Firefox and Safari are not supported
  packaged-app targets.
- Visual-regression baselines across additional density, zoom, and high-contrast
  settings remain useful future hardening.
