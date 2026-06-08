import { useState } from 'react';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
}

/** 点击缩略图放大，再次点击恢复缩小。 */
export function ZoomableImage({ src, alt = '图片', className = '' }: ZoomableImageProps) {
  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    setExpanded((current) => !current);
  }

  return (
    <>
      <button
        type="button"
        className={`zoomable-image-thumb${expanded ? ' zoomable-image-thumb-hidden' : ''} ${className}`.trim()}
        aria-label={expanded ? '缩小图片' : '放大图片'}
        onClick={toggleExpanded}
      >
        <img src={src} alt={alt} draggable={false} />
      </button>
      {expanded && (
        <button
          type="button"
          className="zoomable-image-expanded"
          aria-label="缩小图片"
          onClick={toggleExpanded}
        >
          <img src={src} alt={alt} draggable={false} />
        </button>
      )}
    </>
  );
}
