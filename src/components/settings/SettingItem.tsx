import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { HelpCircle, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BaseSettingItemProps {
  label: string;
  description?: string;
  tooltip?: string;
  onReset?: () => void;
  resetTooltip?: string;
  className?: string;
  children: ReactNode;
}

function BaseSettingItem({
  label,
  description,
  tooltip,
  onReset,
  resetTooltip = "Reset to default",
  className,
  children,
}: BaseSettingItemProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {onReset && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReset}
                  className="h-8 w-8 p-0"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{resetTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

interface SwitchSettingItemProps extends Omit<BaseSettingItemProps, "children"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SwitchSettingItem({
  checked,
  onCheckedChange,
  disabled,
  ...props
}: SwitchSettingItemProps) {
  return (
    <BaseSettingItem {...props}>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </BaseSettingItem>
  );
}

interface SelectSettingItemProps extends Omit<BaseSettingItemProps, "children"> {
  children: ReactNode; // This will be the Select component
}

export function SelectSettingItem({ children, ...props }: SelectSettingItemProps) {
  return (
    <BaseSettingItem {...props}>
      <div className="min-w-48">
        {children}
      </div>
    </BaseSettingItem>
  );
}

interface ButtonSettingItemProps extends Omit<BaseSettingItemProps, "children"> {
  buttonText: string;
  onButtonClick: () => void;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
}

export function ButtonSettingItem({
  buttonText,
  onButtonClick,
  buttonVariant = "outline",
  buttonSize = "sm",
  disabled,
  ...props
}: ButtonSettingItemProps) {
  return (
    <BaseSettingItem {...props}>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={onButtonClick}
        disabled={disabled}
      >
        {buttonText}
      </Button>
    </BaseSettingItem>
  );
}

interface CustomSettingItemProps extends Omit<BaseSettingItemProps, "children"> {
  children: ReactNode;
}

export function CustomSettingItem({ children, ...props }: CustomSettingItemProps) {
  return <BaseSettingItem {...props}>{children}</BaseSettingItem>;
}

export default BaseSettingItem;