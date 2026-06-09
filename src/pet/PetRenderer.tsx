import { useEffect, useMemo, useRef } from 'react';
import { buildFrames, CELL_HEIGHT, CELL_WIDTH, getBackgroundPosition } from './animation';
import type { PetAnimationState } from './types';

interface PetRendererProps {
  spritesheetUrl: string;
  state: PetAnimationState;
  onSpritesheetError?: () => void;
}

export function PetRenderer({ spritesheetUrl, state, onSpritesheetError }: PetRendererProps) {
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const frames = useMemo(() => buildFrames(state), [state]);

  useEffect(() => {
    const element = avatarRef.current;
    if (!element) {
      return;
    }

    let frameIndex = 0;
    let timer: number | undefined;

    const play = () => {
      const frame = frames[frameIndex];
      element.style.backgroundPosition = getBackgroundPosition(frame);
      timer = window.setTimeout(() => {
        frameIndex = (frameIndex + 1) % frames.length;
        play();
      }, frame.durationMs);
    };

    play();

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [frames]);

  useEffect(() => {
    const image = new Image();
    image.onerror = () => {
      onSpritesheetError?.();
    };
    image.src = spritesheetUrl;
  }, [onSpritesheetError, spritesheetUrl]);

  return (
    <div
      ref={avatarRef}
      className="pet-renderer"
      data-pet-state={state}
      style={{
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        backgroundImage: `url(${spritesheetUrl})`,
      }}
    />
  );
}
