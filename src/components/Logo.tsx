import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
    return (
        <div className={cn("relative", className)}>
            {/* Light mode logo (shown when NOT dark) */}
            <img
                src="/black_alpha.png"
                alt="Prompin' Studio"
                className="dark:hidden w-full h-full object-contain"
            />
            {/* Dark mode logo (shown when dark) */}
            <img
                src="/white_alpha.png"
                alt="Prompin' Studio"
                className="hidden dark:block w-full h-full object-contain"
            />
        </div>
    );
};
