import { useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { DashboardCard } from "../../../primitives";
import type { DashboardOptionEntry } from "../../../../data/dashboard.types";

import "./OptionsCard.css";

export interface OptionsCardProps {
  options: DashboardOptionEntry[];
  className?: string;
}

function isToggle(option: DashboardOptionEntry): option is Extract<DashboardOptionEntry, { kind: "toggle" }> {
  return option.kind === "toggle";
}

function isLink(option: DashboardOptionEntry): option is Extract<DashboardOptionEntry, { kind: "link" }> {
  return option.kind === "link";
}

function isAction(option: DashboardOptionEntry): option is Extract<DashboardOptionEntry, { kind: "action" }> {
  return option.kind === "action";
}

export function OptionsCard({ options, className }: OptionsCardProps) {
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(options.filter(isToggle).map((option) => [option.id, option.enabled])),
  );

  useEffect(() => {
    setToggleStates(Object.fromEntries(options.filter(isToggle).map((option) => [option.id, option.enabled])));
  }, [options]);

  function handleToggleChange(id: string, next: boolean) {
    setToggleStates((current) => ({
      ...current,
      [id]: next,
    }));
  }

  return (
    <DashboardCard
      id="dashboard-card-options"
      title="Options & configuration"
      description="Fine-tune automation preferences for your workspace"
      bodyClassName="dashboard-options-card"
      className={className}
    >
      {options.length === 0 ? (
        <div className="dashboard-options-card__empty" role="status">
          <p>No configuration items available.</p>
        </div>
      ) : (
        <ul className="dashboard-options-card__list">
          {options.map((option) => (
            <li key={option.id} className="dashboard-options-card__item">
              <div className="dashboard-options-card__text">
                <p className="dashboard-options-card__title">{option.title}</p>
                <p className="dashboard-options-card__description">{option.description}</p>
              </div>

              {isToggle(option) ? (
                <Switch
                  checked={toggleStates[option.id] ?? option.enabled}
                  onCheckedChange={(checked) => handleToggleChange(option.id, checked)}
                  aria-label={option.title}
                />
              ) : null}

              {isLink(option) ? (
                <a href={option.href} className="dashboard-card__link">
                  Open
                </a>
              ) : null}

              {isAction(option) ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={option.disabled}
                  className="dashboard-card__action"
                >
                  {option.actionLabel}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
