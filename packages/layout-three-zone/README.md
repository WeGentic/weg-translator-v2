# @wegentic/layout-three-zone

Reusable three-zone panel layout (header, toolbar, content, optional footer) shared across Weg Translator workspaces.

## Installation

This package is part of the Weg Translator npm workspace and is consumed via the workspace path:

```tsx
import { ThreeZonePanel } from "@wegentic/layout-three-zone";
```

## Basic Usage

```tsx
import { ThreeZonePanel } from "@wegentic/layout-three-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ExamplePanel() {
  return (
    <ThreeZonePanel
      header={<h2 className="text-lg font-semibold">Dashboard</h2>}
      toolbar={
        <div className="flex w-full items-center gap-2">
          <Input placeholder="Search projects" className="max-w-xs" />
          <Button variant="outline">Create</Button>
        </div>
      }
      footer={<span className="text-xs text-muted-foreground">0 items</span>}
    >
      <div className="p-4 text-sm text-muted-foreground">
        Content area with `min-height: 0` and auto scrolling.
      </div>
    </ThreeZonePanel>
  );
}
```

## Compound Slots

```tsx
import { ThreeZonePanel } from "@wegentic/layout-three-zone";

export function SlotSyntaxPanel() {
  return (
    <ThreeZonePanel>
      <ThreeZonePanel.Header>
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg font-semibold">Resources</h2>
        </div>
      </ThreeZonePanel.Header>
      <ThreeZonePanel.Toolbar>
        <span className="text-sm text-muted-foreground">Filters go here</span>
      </ThreeZonePanel.Toolbar>
      <ThreeZonePanel.Content>
        <div className="p-4">Main content</div>
      </ThreeZonePanel.Content>
      <ThreeZonePanel.Footer>
        <span className="text-xs text-muted-foreground">Footer status</span>
      </ThreeZonePanel.Footer>
    </ThreeZonePanel>
  );
}
```

### Props

- `header`, `toolbar`, `footer`: Optional slot content supplied via props (React nodes).
- `slotProps`: Optional attributes for each zone (className, data attributes, etc.).
- `contentOverflow`: `"auto" | "hidden"` – controls content scroll behavior (`auto` by default).
- `variant`: `"default" | "quiet"` – adjusts visual intensity.

CSS is bundled from `src/styles/panel.css` and uses WeGentic color tokens defined in `src/App.css`.
