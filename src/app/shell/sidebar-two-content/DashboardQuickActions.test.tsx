/**
 * Testing Component for Sidebar Two CSS Styles
 *
 * This file demonstrates all CSS classes with interactive examples.
 * Use this component to visually test all button, zone, and selectable item states.
 *
 * To use: Import and render this component in your development environment.
 */

import { Plus, FileUp, Folder, Settings, Home, FileText } from "lucide-react";
import "./css/sidebar-two-button.css";
import "./css/sidebar-two-zone.css";
import "./css/sidebar-two-selectable-item.css";

export function SidebarTwoStylesTest() {
  return (
    <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", padding: "2rem" }}>
      {/* Button Tests */}
      <div className="sidebar-two-button-test-container">
        <h2>Sidebar Two Buttons</h2>

        <h3>Normal State</h3>
        <button className="sidebar-two-button">
          <Plus className="size-4" />
          Create Project
        </button>

        <h3>Hover (Hover over button)</h3>
        <button className="sidebar-two-button">
          <FileUp className="size-4" />
          Upload File
        </button>

        <h3>Clicked/Active</h3>
        <button className="sidebar-two-button sidebar-two-button--clicked">
          <Settings className="size-4" />
          Settings
        </button>

        <h3>Inactive/Disabled</h3>
        <button className="sidebar-two-button sidebar-two-button--inactive">
          <Folder className="size-4" />
          Disabled Action
        </button>

        <h3>Secondary Variant</h3>
        <button className="sidebar-two-button sidebar-two-button--secondary">
          <Home className="size-4" />
          Secondary
        </button>

        <h3>Ghost Variant</h3>
        <button className="sidebar-two-button sidebar-two-button--ghost">
          <FileText className="size-4" />
          Ghost
        </button>

        <h3>Outline Variant</h3>
        <button className="sidebar-two-button sidebar-two-button--outline">
          <FileText className="size-4" />
          Outline
        </button>
      </div>

      {/* Zone Tests */}
      <div className="sidebar-two-zone-test-container">
        <h2>Sidebar Two Zones</h2>

        <h3>Basic Zone</h3>
        <div className="sidebar-two-zone">
          <div className="sidebar-two-zone__header">
            <FileUp />
            Zone Header
          </div>
          <div className="sidebar-two-zone__content">
            <p>This is the zone content area. It can contain any elements.</p>
          </div>
        </div>

        <h3>Compact Zone</h3>
        <div className="sidebar-two-zone sidebar-two-zone--compact">
          <div className="sidebar-two-zone__header">
            <Settings />
            Compact Header
          </div>
          <div className="sidebar-two-zone__content">
            <p>Less padding, more compact.</p>
          </div>
        </div>

        <h3>Accent Zone</h3>
        <div className="sidebar-two-zone sidebar-two-zone--accent">
          <div className="sidebar-two-zone__header">
            <Plus />
            Highlighted
          </div>
          <div className="sidebar-two-zone__content">
            <p>Accent background for emphasis.</p>
          </div>
        </div>

        <h3>Interactive Zone (Hover)</h3>
        <div className="sidebar-two-zone sidebar-two-zone--interactive">
          <div className="sidebar-two-zone__header">
            <Folder />
            Clickable Zone
          </div>
          <div className="sidebar-two-zone__content">
            <p>Hover to see interactive effect.</p>
          </div>
        </div>

        <h3>Zone with Footer</h3>
        <div className="sidebar-two-zone">
          <div className="sidebar-two-zone__header">
            <FileText />
            With Footer
          </div>
          <div className="sidebar-two-zone__content">
            <p>Content area with footer below.</p>
          </div>
          <div className="sidebar-two-zone__footer">
            <span>Footer text</span>
            <span>2 items</span>
          </div>
        </div>
      </div>

      {/* Selectable Item Tests */}
      <div className="sidebar-two-selectable-item-test-container">
        <h2>Selectable Items</h2>

        <h3>Not Selected (Hover to see effect)</h3>
        <div className="sidebar-two-selectable-item-test-section">
          <button className="sidebar-two-selectable-item">
            <Home className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Dashboard</span>
          </button>
          <button className="sidebar-two-selectable-item">
            <Folder className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Projects</span>
            <span className="sidebar-two-selectable-item__meta">5</span>
          </button>
        </div>

        <h3>Selected State</h3>
        <div className="sidebar-two-selectable-item-test-section">
          <button className="sidebar-two-selectable-item sidebar-two-selectable-item--selected">
            <FileText className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Documents</span>
          </button>
          <button className="sidebar-two-selectable-item sidebar-two-selectable-item--selected">
            <Settings className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Settings</span>
            <span className="sidebar-two-selectable-item__badge">3</span>
          </button>
        </div>

        <h3>Inactive/Disabled</h3>
        <div className="sidebar-two-selectable-item-test-section">
          <button className="sidebar-two-selectable-item sidebar-two-selectable-item--inactive">
            <FileUp className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Disabled Item</span>
          </button>
        </div>

        <h3>Compact Variant</h3>
        <div className="sidebar-two-selectable-item-test-section">
          <button className="sidebar-two-selectable-item sidebar-two-selectable-item--compact">
            <Home className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Compact Item</span>
          </button>
          <button className="sidebar-two-selectable-item sidebar-two-selectable-item--compact sidebar-two-selectable-item--selected">
            <Folder className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Selected Compact</span>
          </button>
        </div>

        <h3>With Chevron Indicator</h3>
        <div className="sidebar-two-selectable-item-test-section">
          <button className="sidebar-two-selectable-item sidebar-two-selectable-item--with-chevron">
            <Folder className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Has Submenu</span>
          </button>
          <button className="sidebar-two-selectable-item sidebar-two-selectable-item--with-chevron sidebar-two-selectable-item--selected">
            <Settings className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Selected with Chevron</span>
          </button>
        </div>

        <h3>Complete List Example</h3>
        <div className="sidebar-two-selectable-list">
          <div className="sidebar-two-selectable-item sidebar-two-selectable-item--group-header">
            Navigation
          </div>
          <button className="sidebar-two-selectable-item">
            <Home className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Home</span>
          </button>
          <button className="sidebar-two-selectable-item sidebar-two-selectable-item--selected">
            <Folder className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Projects</span>
            <span className="sidebar-two-selectable-item__badge">12</span>
          </button>
          <button className="sidebar-two-selectable-item">
            <FileText className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Documents</span>
          </button>
          <div className="sidebar-two-selectable-item sidebar-two-selectable-item--group-header">
            Settings
          </div>
          <button className="sidebar-two-selectable-item">
            <Settings className="sidebar-two-selectable-item__icon" />
            <span className="sidebar-two-selectable-item__label">Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Example: How to apply these styles to the existing DashboardQuickActions component
 */
export function DashboardQuickActionsStyled() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Apply sidebar-two-button class */}
      <button className="sidebar-two-button">
        <Plus className="size-4" />
        Create Project
      </button>

      {/* Apply sidebar-two-zone class */}
      <div className="sidebar-two-zone">
        <div className="sidebar-two-zone__header">
          <FileUp />
          Create from File
        </div>
        <div className="sidebar-two-zone__content">
          <div
            className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/25 p-4 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
          >
            <FileUp className="size-8 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium">Drop file here or click</p>
              <p className="mt-1">to create a project from an existing file</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
