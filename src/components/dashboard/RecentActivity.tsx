import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface ActivityItem {
    id: string;
    type: 'create' | 'update' | 'delete';
    assetId: string;
    timestamp: number;
    details?: any;
}

interface RecentActivityProps {
    activity: ActivityItem[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activity }) => {
    if (!activity || activity.length === 0) {
        return <div className="text-sm text-muted-foreground">No recent activity.</div>;
    }

    return (
        <div className="space-y-8">
            {activity.map((item) => (
                <div key={item.id} className="flex items-center">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={`thumbnail://${item.assetId}.jpg`} alt="Asset Thumbnail" />
                        <AvatarFallback>{item.type === 'create' ? 'NEW' : 'UPD'}</AvatarFallback>
                    </Avatar>
                    <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">
                            {item.type === 'create' ? 'New Asset Added' :
                                item.type === 'update' ? 'Asset Updated' : 'Asset Deleted'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {new Date(item.timestamp).toLocaleString()}
                        </p>
                    </div>
                    <div className="ml-auto font-medium text-xs text-muted-foreground">
                        {item.assetId.substring(0, 8)}...
                    </div>
                </div>
            ))}
        </div>
    );
};
