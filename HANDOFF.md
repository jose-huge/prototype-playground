# Compass Pathways — Dev Handoff
## Page Transition + Navigation

---

## What's included

```
app/
  components/
    PageTransition.tsx        Production curtain transition component
    PageTransition.module.css Transition styles
    Nav.tsx                   Navigation component
    Nav.module.css            Navigation styles
  lib/
    pageTransitionConfig.ts   Single source of truth for all timing + palette
    titleMap.ts               Pathname → page title map for the curtain label
public/
  icons/
    compass-logo-white.svg    Used by Nav (white version for dark background)
    compass-logo.svg          Dark version for light backgrounds
```

---

## 1. Page Transition — how to wire it up

Mount `<PageTransition />` **once** in your root layout, outside any Suspense
boundary. It needs to persist across route changes.

```tsx
// app/layout.tsx
import PageTransition from "@/app/components/PageTransition";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PageTransition />
        {children}
      </body>
    </html>
  );
}
```

That's it. The component self-manages — no context, no providers needed.

---

## 2. Opting links into the transition

Add `data-page-transition` to any `<a>` link **or** a parent container to opt
all links inside into the transition.

```tsx
// Single link
<a href="/about" data-page-transition>Who We Are</a>

// Whole nav — all links inside get the transition
<nav data-page-transition>
  <a href="/about">Who We Are</a>
  <a href="/investors">Investors</a>
</nav>
```

Links **without** the attribute navigate normally — zero risk of accidentally
catching links you don't want animated.

---

## 3. Update the title map

When the curtain covers the screen it shows the destination page's title.
These are defined in `app/lib/titleMap.ts`. Update this to match your routes:

```ts
export const titleMap: Record<string, string> = {
  "/":            "Home",
  "/about":       "Who We Are",
  "/products":    "Our Products",
  "/investors":   "Investors",
  // add new routes here
};
```

If a route isn't in the map the curtain shows no text — navigation still works
fine, the label just stays blank.

---

## 4. Tuning the animation

All timing and visual values live in one file: `app/lib/pageTransitionConfig.ts`

| Key               | Default | What it controls                                      |
|-------------------|---------|-------------------------------------------------------|
| `panelDuration`   | 500ms   | How fast the curtain rises / falls                    |
| `coverMs`         | 1100ms  | Time before router.push fires (curtain fully down)    |
| `revealMs`        | 1100ms  | Time before curtain returns to idle                   |
| `navCloseDelayMs` | 150ms   | Delay between nav item click and curtain start        |
| `palette`         | 5 colors| Random colour picked per navigation                   |

---

## 5. Nav component — ⚠️ SEO action required

The Nav items in this handoff use `<button>` elements because the workbench
has no real routes. **Before shipping, convert all nav items to `<a href>` or
Next.js `<Link>` elements.** This is critical for:

- Search engine crawlers (Googlebot follows `<a href>`, not `<button>`)
- Right-click → open in new tab
- Middle-click to open in new tab
- Cmd/Ctrl+click
- URL preview on hover

```tsx
// ❌ Current (workbench only — not crawlable)
<button onClick={() => onNavigate?.("/about", "Who We Are")}>
  Who We Are
</button>

// ✅ Production — crawlable, all native link behaviours work
<Link href="/about" data-page-transition className={styles.head}>
  Who We Are
</Link>
```

Add `data-page-transition` to the nav container (or each link) to opt the nav
into the curtain transition automatically:

```tsx
<nav data-page-transition>
  <Link href="/about" className={styles.head}>Who We Are</Link>
  <Link href="/investors" className={styles.head}>Investors</Link>
</nav>
```

---

## 6. SEO safety of the transition itself

The `PageTransition` component is fully SEO-safe:

- All links remain real `<a href>` elements in the DOM at all times
- Crawlers don't execute JavaScript — they see and follow the links normally
- With JS disabled, all links navigate with a standard full-page reload
- The overlay is `aria-hidden="true"` — invisible to screen readers
- No changes to URLs, canonical tags, or server-rendered HTML
- `prefers-reduced-motion: reduce` skips the animation entirely and navigates
  instantly (configurable via `reducedMotion` in pageTransitionConfig.ts)

---

## 7. Nav + transition coordination

When a nav item is clicked the transition automatically waits `navCloseDelayMs`
(default 150ms) before firing the curtain, giving the nav time to start closing
so the two animations don't collide.

This is handled in two places:
- **Simulator / Nav.tsx**: `onNavigate` callback fires into the transition
- **Production / PageTransition.tsx**: listens for `compass:nav-close` custom
  event dispatched on `document` when a nav link is intercepted

No extra wiring needed — as long as the nav and `<PageTransition />` are both
mounted, the coordination is automatic.

---

## Dependencies

- React 18+
- Next.js App Router (uses `usePathname` + `useRouter` from `next/navigation`)
- No GSAP — animation is pure CSS transitions
- No additional npm packages required
