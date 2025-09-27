import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({ title, description, children, className }: SettingsSectionProps) {
  return (
    <Card className={`border-border/60 bg-card/80 shadow-sm backdrop-blur ${className ?? ""}`}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

interface SettingsSeparatorProps {
  className?: string;
}

export function SettingsSeparator({ className }: SettingsSeparatorProps) {
  return <Separator className={className} />;
}

export default SettingsSection;