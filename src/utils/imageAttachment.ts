const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** 将用户选择的图片文件转成 data URL，供预览和发送展示。 */
export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('仅支持图片文件。'));
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error('图片不能超过 4MB。'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('图片读取失败。'));
    };
    reader.onerror = () => reject(new Error('图片读取失败。'));
    reader.readAsDataURL(file);
  });
}

/** 从剪贴板事件中提取第一张图片。 */
export function extractClipboardImageFile(event: React.ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) {
    return null;
  }

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        return file;
      }
    }
  }

  return null;
}
