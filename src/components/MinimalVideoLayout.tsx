import { Controls, Gesture, TimeSlider, PlayButton, MuteButton, Time } from '@vidstack/react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

export function MinimalVideoLayout() {
    return (
        <>
            <Gesture className="absolute inset-0 z-0 block h-full w-full" event="pointerup" action="toggle:paused" />

            <Controls.Root className="absolute inset-0 z-10 flex h-full w-full flex-col bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity hover:opacity-100">
                <div className="flex-1" />

                {/* Bottom controls */}
                <div className="flex w-full flex-col gap-1 p-2">
                    {/* Timeline */}
                    <TimeSlider.Root className="group relative w-full h-1 cursor-pointer">
                        <TimeSlider.Track className="absolute inset-0 w-full h-1 bg-white/20 rounded-full overflow-hidden">
                            <TimeSlider.TrackFill className="absolute left-0 top-0 h-full w-[var(--slider-fill)] bg-primary rounded-full" />
                        </TimeSlider.Track>
                        <TimeSlider.Thumb className="absolute left-[var(--slider-fill)] top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
                    </TimeSlider.Root>

                    {/* Control buttons */}
                    <div className="flex items-center gap-2">
                        <PlayButton className="group inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors">
                            <Play className="w-4 h-4 text-white hidden group-data-[paused]:block fill-current" />
                            <Pause className="w-4 h-4 text-white hidden group-data-[playing]:block fill-current" />
                        </PlayButton>

                        <MuteButton className="group inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors">
                            <Volume2 className="w-4 h-4 text-white hidden group-data-[volume]:block" />
                            <VolumeX className="w-4 h-4 text-white hidden group-data-[muted]:block" />
                        </MuteButton>

                        <Time className="text-xs text-white font-mono" type="current" />
                        <span className="text-xs text-white/70">/</span>
                        <Time className="text-xs text-white font-mono" type="duration" />
                    </div>
                </div>
            </Controls.Root>
        </>
    );
}
