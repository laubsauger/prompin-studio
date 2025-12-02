import React from 'react';
import { useStore } from '../store';
import type { Asset } from '../types';

export const FilterBar: React.FC = () => {
    const { filter, setFilter } = useStore();

    return (
        <div className="filters">
            <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as Asset['status'] | 'all')}
                style={{ padding: '0.5rem', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #444' }}
            >
                <option value="all">All Statuses</option>
                <option value="unsorted">Unsorted</option>
                <option value="review_requested">Review Requested</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="archived">Archived</option>
            </select>
        </div>
    );
};
