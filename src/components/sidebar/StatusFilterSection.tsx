import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SidebarSection } from './SidebarSection';

interface StatusFilterSectionProps {
    isOpen: boolean;
    onToggle: () => void;
}

export const StatusFilterSection: React.FC<StatusFilterSectionProps> = ({ isOpen, onToggle }) => {
    const assets = useStore(state => state.assets);
    const filterConfig = useStore(state => state.filterConfig);
    const setFilterConfig = useStore(state => state.setFilterConfig);

    return (
        <SidebarSection
            title="Review Status"
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <Button
                variant="ghost"
                size="sm"
                className={cn(
                    "w-full justify-start gap-2 h-7 px-4",
                    filterConfig.status === 'review_requested' && "bg-accent"
                )}
                onClick={() => {
                    setFilterConfig({
                        status: filterConfig.status === 'review_requested' ? undefined : 'review_requested'
                    });
                }}
            >
                <AlertCircle className="h-3 w-3 text-yellow-500" />
                <span className="flex-1 text-left text-xs">Review Requested</span>
                <span className="text-[10px] text-muted-foreground">
                    {assets.filter(a => a.status === 'review_requested').length}
                </span>
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className={cn(
                    "w-full justify-start gap-2 h-7 px-4",
                    filterConfig.status === 'pending' && "bg-accent"
                )}
                onClick={() => {
                    setFilterConfig({
                        status: filterConfig.status === 'pending' ? undefined : 'pending'
                    });
                }}
            >
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="flex-1 text-left text-xs">Pending Approval</span>
                <span className="text-[10px] text-muted-foreground">
                    {assets.filter(a => a.status === 'pending').length}
                </span>
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className={cn(
                    "w-full justify-start gap-2 h-7 px-4",
                    filterConfig.status === 'approved' && "bg-accent"
                )}
                onClick={() => {
                    setFilterConfig({
                        status: filterConfig.status === 'approved' ? undefined : 'approved'
                    });
                }}
            >
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span className="flex-1 text-left text-xs">Approved</span>
                <span className="text-[10px] text-muted-foreground">
                    {assets.filter(a => a.status === 'approved').length}
                </span>
            </Button>
        </SidebarSection>
    );
};
