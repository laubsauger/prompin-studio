import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarSectionProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({ title, isOpen, onToggle, action, children, className }) => (
    <div className={cn("py-2", className)}>
        <div className="flex items-center justify-between px-3 mb-1 group">
            <button
                onClick={onToggle}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {title}
            </button>
            {action && <div className="opacity-0 group-hover:opacity-100 transition-opacity">{action}</div>}
        </div>
        {isOpen && <div className="space-y-0.5">{children}</div>}
    </div>
);
