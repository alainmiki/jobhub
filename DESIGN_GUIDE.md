# JobHub Design System & Style Guide

## Overview
This style guide documents the design rationale behind the JobHub UI redesign, inspired by professional job platforms like LinkedIn, Indeed, and Glassdoor.

---

## Design Philosophy

### Core Principles
1. **Trust & Professionalism** - Clean, minimal design that communicates reliability
2. **Clarity** - Information hierarchy that guides users naturally
3. **Engagement** - Subtle animations that delight without distracting
4. **Accessibility** - WCAG 2.1 AA compliance as a baseline

---

## Color Palette

### Primary Colors
```css
--color-primary: #4F46E5;      /* Indigo - Trust, professionalism */
--color-primary-hover: #4338CA;
--color-secondary: #6366F1;     /* Lighter indigo for accents */
--color-accent: #10B981;       /* Emerald - Success states */
```

### Surface & Text
```css
--color-surface: #FFFFFF;
--color-surface-elevated: #F8FAFC;
--color-border-subtle: #E2E8F0;
--color-text-primary: #0F172A;
--color-text-secondary: #475569;
--color-text-muted: #94A3B8;
```

### Why This Palette?
- **Indigo (#4F46E5)**: Associated with trust, intelligence, and technology. Used by LinkedIn and many professional platforms.
- **Emerald (#10B981)**: Positive, growth-oriented. Used for success states and CTAs.
- **Slate grays**: Softer than pure black, reducing eye strain while maintaining readability.

---

## Typography

### Font Stack
```css
--font-sans: 'DM Sans', system-ui, sans-serif;
--font-display: 'Outfit', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### Usage
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Headings | Outfit | 1.875-3rem | 600-700 |
| Body | DM Sans | 1rem | 400 |
| Labels | DM Sans | 0.875rem | 500 |
| Code | JetBrains Mono | 0.875rem | 400 |

### Why These Fonts?
- **DM Sans**: Excellent readability, modern geometric sans-serif with humanist touches
- **Outfit**: Modern display font with great weight variation, perfect for headings
- **JetBrains Mono**: Clean monospace for technical content

---

## Spacing System

### Base Units
```css
--spacing-sm: 0.375rem;   /* 6px */
--spacing-md: 0.5rem;     /* 8px */
--spacing-lg: 1rem;       /* 16px */
--spacing-xl: 1.5rem;     /* 24px */
--spacing-2xl: 2rem;      /* 32px */
```

### Border Radius
```css
--radius-sm: 0.375rem;   /* 6px - buttons */
--radius-md: 0.5rem;     /* 8px - inputs */
--radius-lg: 0.75rem;    /* 12px - cards */
--radius-xl: 1rem;      /* 16px - modals */
--radius-2xl: 1.5rem;    /* 24px - hero elements */
```

---

## Components

### Buttons

#### Primary Button (btn-primary-gradient)
- Gradient background: `linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)`
- Rounded corners: `border-radius: 0.75rem`
- Shadow: `0 10px 20px -5px rgba(79, 70, 229, 0.4)`
- Hover: `translateY(-2px)` + enhanced shadow

#### Ghost Button
- Transparent background
- Border on hover
- Subtle background on hover: `rgba(79, 70, 229, 0.1)`

### Cards

#### Standard Card
- Background: base-100
- Border: 1px solid rgba(0,0,0,0.05)
- Shadow: var(--shadow-card)
- Border radius: var(--radius-xl)

#### Hover Card (card-hover-lift)
- Transform: `translateY(-4px)` on hover
- Enhanced shadow on hover
- Border color transition to primary/30

#### Glow Card (card-border-glow)
- Subtle gradient border on hover
- Creates premium feel without visual clutter

### Form Inputs

#### Modern Input (input-modern)
- Background: var(--color-surface-elevated)
- Border: 1px solid var(--color-border-subtle)
- Focus state: 3px ring with primary/15 opacity
- Icon prefix support

---

## Animations (GSAP)

### Page Transitions
```javascript
// Main content fade in
gsap.from('#main-content', {
  opacity: 0,
  y: 20,
  duration: 0.5,
  ease: 'power2.out'
});
```

### Stagger Animations
```javascript
gsap.from('.gsap-reveal', {
  opacity: 0,
  y: 30,
  duration: 0.6,
  stagger: 0.15,
  ease: 'power3.out'
});
```

### Scroll Animations
```javascript
gsap.utils.toArray('.gsap-animate').forEach((el, i) => {
  gsap.from(el, {
    scrollTrigger: { trigger: el, start: 'top 80%' },
    opacity: 0,
    y: 30,
    duration: 0.6,
    delay: i * 0.1
  });
});
```

### Hover Effects
- Buttons: Scale up + shadow
- Cards: Lift + border glow
- Links: Underline animation

---

## Layout

### Responsive Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Container
- Max width: 1280px (7xl)
- Padding: 1rem (16px) mobile, 2rem (32px) desktop

---

## Accessibility (WCAG 2.1 AA)

### Requirements Met
1. **Color Contrast**: Minimum 4.5:1 for text
2. **Focus States**: Visible focus rings on all interactive elements
3. **Keyboard Navigation**: All functionality accessible via keyboard
4. **ARIA Labels**: Proper labels on icons and buttons
5. **Reduced Motion**: Respects `prefers-reduced-motion`
6. **Screen Reader**: Semantic HTML structure

### Focus States
```css
.focus-ring:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3);
}
```

---

## Before & After Comparison

### Sign-In Page

#### Before
- Basic centered card
- Simple input fields
- Standard DaisyUI button
- No visual hierarchy

#### After
- Hero pattern background
- Gradient icon container
- Input icons with floating labels feel
- Gradient primary button with hover effects
- Divider with "OR" text
- Terms and conditions footer

### Job Listing

#### Before
- Basic card list
- Square avatars
- Basic hover states
- No animations

#### After
- Rounded card hover lift effect
- Company logo with rounded corners
- "View" button appears on hover
- Staggered animation on scroll
- Filter sidebar with modern styling

### Header

#### Before
- Basic navbar
- Simple dropdown menu
- Standard buttons

#### After
- Backdrop blur effect
- Gradient logo badge
- Smooth scroll shadow effect
- Animated dropdown with icons
- "Get Started" gradient button

---

## File Structure

```
src/
├── public/
│   └── css/
│       └── input.css      # Design system
├── views/
│   ├── layout.html        # Main layout with GSAP
│   ├── partials/
│   │   ├── header.html    # Modern navigation
│   │   └── footer.html    # Site footer
│   ├── sign-in.html       # Auth page
│   ├── sign-up.html       # Registration
│   └── jobs/
│       └── index.html     # Job listing
└── utils/
    └── authUtils.js       # Auth utilities
```

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Performance Considerations

1. **CSS**: Tailwind generates minimal CSS
2. **Fonts**: Google Fonts with preconnect
3. **Images**: Lazy loading for job listings
4. **Animations**: GPU-accelerated transforms
5. **Reduced Motion**: Respects user preferences

---

*Document Version: 1.0*
*Last Updated: April 2026*
