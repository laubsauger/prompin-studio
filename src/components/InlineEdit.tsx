import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { Input } from './ui/input';
import { Edit2 } from 'lucide-react';

interface InlineEditProps {
    value: string;
    onSave: (value: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
    inputClassName?: string;
}

export function InlineEdit({
    value,
    onSave,
    placeholder = 'Click to edit',
    label,
    className,
    inputClassName
}: InlineEditProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editValue !== value) {
            onSave(editValue);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    if (isEditing) {
        return (
            <div className={cn("space-y-1", className)}>
                {label && <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>}
                <div className="flex items-center gap-1">
                    <Input
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        className={cn("h-7 text-xs px-2 py-1", inputClassName)}
                        placeholder={placeholder}
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn("group cursor-pointer space-y-0.5 hover:bg-muted/30 p-1 -m-1 rounded transition-colors", className)}
            onClick={() => setIsEditing(true)}
        >
            {label && <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center justify-between">
                {label}
                <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50" />
            </div>}
            <div className={cn("text-xs truncate min-h-[1.25rem] flex items-center", !value && "text-zinc-700 dark:text-zinc-600 italic")}>
                {value || placeholder}
            </div>
        </div>
    );
}
