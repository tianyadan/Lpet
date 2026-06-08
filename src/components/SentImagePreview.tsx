import { ZoomableImage } from './ZoomableImage';

interface SentImagePreviewProps {
  src: string;
  isBubbleVisible: boolean;
}

/** 展示已发送图片，点击可放大/缩小。 */
export function SentImagePreview({ src, isBubbleVisible }: SentImagePreviewProps) {
  return (
    <section
      className={`pet-sent-image${isBubbleVisible ? ' pet-sent-image-above-bubble' : ''}`}
      aria-label="已发送图片"
    >
      <ZoomableImage src={src} alt="已发送图片" />
    </section>
  );
}
