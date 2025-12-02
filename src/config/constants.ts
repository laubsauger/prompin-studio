import { type AssetStatus } from '../types';

export const ASSET_STATUSES: Record<AssetStatus, { label: string; color: string }> = {
    unsorted: { label: 'Unsorted', color: 'bg-gray-500' },
    review_requested: { label: 'Review Requested', color: 'bg-yellow-500' },
    pending: { label: 'Pending', color: 'bg-orange-500' },
    approved: { label: 'Approved', color: 'bg-green-500' },
    archived: { label: 'Archived', color: 'bg-slate-700' },
    offline: { label: 'Offline', color: 'bg-red-500' },
    tagged: { label: 'Tagged', color: 'bg-blue-500' },
};

export const STATUS_OPTIONS = Object.entries(ASSET_STATUSES).map(([value, { label }]) => ({
    value: value as AssetStatus,
    label,
}));
