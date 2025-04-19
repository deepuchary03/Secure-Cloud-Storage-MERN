import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  bgColor?: string;
  iconColor?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  bgColor = "bg-primary-100",
  iconColor = "text-primary-600",
  className,
}: StatsCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center">
        <div className={cn("p-3 rounded-md", bgColor)}>
          <div className={cn("w-6 h-6", iconColor)}>{icon}</div>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <h3 className="text-xl font-bold text-neutral-900">{value}</h3>
        </div>
      </div>
    </Card>
  );
}
