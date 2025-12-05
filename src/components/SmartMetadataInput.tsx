import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from './ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';

interface SmartMetadataInputProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    title?: string;
    className?: string;
}

export function SmartMetadataInput({
    value,
    onChange,
    options,
    placeholder = "Select...",
    title = "Select",
    className
}: SmartMetadataInputProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");

    // Filter options based on input value if needed, though Command does this automatically.
    // We need to know if there's an exact match to show/hide the "Create" option.
    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        return options.filter(opt => opt.toLowerCase().includes(inputValue.toLowerCase()));
    }, [options, inputValue]);

    const hasExactMatch = useMemo(() => {
        return options.some(opt => opt.toLowerCase() === inputValue.toLowerCase());
    }, [options, inputValue]);

    const handleSelect = (currentValue: string) => {
        onChange(currentValue);
        setOpen(false);
        setInputValue("");
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
                >
                    {value || placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={`Search ${title.toLowerCase()}...`}
                        value={inputValue}
                        onValueChange={setInputValue}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {!inputValue ? "No results found." : (
                                <div
                                    className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm"
                                    onClick={() => handleSelect(inputValue)}
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Create "{inputValue}"</span>
                                </div>
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {filteredOptions.map((option) => (
                                <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={() => handleSelect(option)}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {inputValue && !hasExactMatch && filteredOptions.length > 0 && (
                            <CommandGroup heading="Create">
                                <CommandItem
                                    value={inputValue}
                                    onSelect={() => handleSelect(inputValue)}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create "{inputValue}"
                                </CommandItem>
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
