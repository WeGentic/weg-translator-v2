Styling Guide: Chrome Surfaces

Scope: Header, Footer, Sidebar, Main. Keep styling predictable and easy to override.

- Header
  - Base: `app-header` (src/app/layout/css-styles/chrome/header/app-header.css)
  - Elevation: add `app-header--elevated` to enable shadow
  - Override tips: apply Tailwind utilities on the container or wrap with your own class

- Sidebar
  - Base: `app-sidebar` (src/app/layout/css-styles/chrome/sidebar/app-sidebar.css)
  - Elevation: `app-sidebar--elevated` adds shadow (enabled by default in AppSidebar)
  - Floating: `app-sidebar--floating` positions it fixed within the content inset
  - Override tips: pass `className` to AppSidebar or add utilities on your wrapper

- Footer
  - Base: `workspace-footer` (src/app/layout/css-styles/chrome/footer/workspace-footer.css)
  - Elevation: add `workspace-footer--elevated` to enable shadow
  - Placement handled by the layout grid; do not use `position: sticky` here

- Main
  - Base: `layout-main` and `layout-main__content` (src/app/layout/css-styles/layout-main.css)
  - Scrolling: toggle `layout-main__content--scroll-auto` or `--scroll-hidden`

Best Practices
- Keep chrome CSS unlayered for straightforward precedence; use modifier classes for variants.
- Utilities on the element override component styles; prefer modifiers for reusable variants.
- Sticky does not work inside the grid shell due to overflow; rely on grid rows for header/footer.

