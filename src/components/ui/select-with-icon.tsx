import * as React from "react"
import { cn } from "../../lib/utils"
import { ChevronDown } from "lucide-react"

export interface SelectWithIconProps
    extends React.SelectHTMLAttributes<HTMLSelectElement> {
    icon?: React.ReactNode;
}

const SelectWithIcon = React.forwardRef<HTMLSelectElement, SelectWithIconProps>(
    ({ className, children, icon, ...props }, ref) => {
        return (
            <div className="relative">
                <select
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
                        icon ? "pl-8 pr-8" : "px-3",
                        className
                    )}
                    ref={ref}
                    {...props}
                >
                    {children}
                </select>
                {icon && (
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {icon}
                    </div>
                )}
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 opacity-50 pointer-events-none" />
            </div>
        )
    }
)
SelectWithIcon.displayName = "SelectWithIcon"

export { SelectWithIcon }