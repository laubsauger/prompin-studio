import React from 'react';
import { useStore } from '../store';
import { Select } from './ui/select';
import { STATUS_OPTIONS } from '../config/constants';
import { Filter } from 'lucide-react';

export const FilterBar: React.FC = () => {
    const { filter, setFilter } = useStore();

    return (
        <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="w-[180px] h-9"
            >
                <option value="all">All Statuses</option>
                {STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </Select>
        </div>
    );
};
