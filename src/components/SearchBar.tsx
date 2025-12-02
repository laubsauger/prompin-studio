import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '../store';
import { debounce } from '../utils/debounce';
import { cn } from '../lib/utils';

export function SearchBar() {
    const { searchQuery, setSearchQuery, searchAssets } = useStore();
    const [localQuery, setLocalQuery] = useState(searchQuery);

    // Debounced search function
    const debouncedSearch = useCallback(
        debounce((query: string) => {
            setSearchQuery(query);
            searchAssets(query);
        }, 300),
        []
    );

    useEffect(() => {
        setLocalQuery(searchQuery);
    }, [searchQuery]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocalQuery(value);
        debouncedSearch(value);
    };

    const handleClear = () => {
        setLocalQuery('');
        setSearchQuery('');
        searchAssets('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleClear();
        }
    };

    return (
        <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
                type="text"
                value={localQuery}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className={cn(
                    "h-7 w-full pl-7 pr-7 text-xs",
                    "bg-secondary/50 border border-border rounded",
                    "text-foreground placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring",
                    "transition-colors"
                )}
            />
            {localQuery && (
                <button
                    onClick={handleClear}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    aria-label="Clear search"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}