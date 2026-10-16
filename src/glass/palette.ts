import { useEffect, useState } from 'react';
export interface Palette {
  dominant: string;
  secondary: string;
  highlight: string;
  shadow: string;
  warm: string;
  cool: string;
}
const fallback: Palette = {
  dominant: '#334a4b',
  secondary: '#776749',
  highlight: '#b3b69a',
  shadow: '#111b20',
  warm: '#8f654a',
  cool: '#364e60',
};
const cache = new Map<string, Palette>();
const hex = (color: number[]) =>
  `#${color.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
const luminance = (color: number[]) => color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
export function extractPalette(image: HTMLImageElement): Palette {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return fallback;
  context.drawImage(image, 0, 0, 32, 32);
  const pixels = context.getImageData(0, 0, 32, 32).data;
  const bins = new Map<string, { count: number; sum: number[] }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = rgb.map((value) => Math.floor(value / 40)).join(',');
    const bin = bins.get(key) || { count: 0, sum: [0, 0, 0] };
    bin.count++;
    rgb.forEach((value, channel) => {
      bin.sum[channel] += value;
    });
    bins.set(key, bin);
  }
  const colors = [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .map((bin) => bin.sum.map((value) => value / bin.count));
  if (!colors.length) return fallback;
  const main = colors[0];
  const secondary =
    colors.find(
      (color) => color.reduce((sum, value, i) => sum + Math.abs(value - main[i]), 0) > 95,
    ) ||
    colors[1] ||
    main;
  const light = [...colors].sort((a, b) => luminance(b) - luminance(a));
  const warmth = [...colors].sort((a, b) => b[0] - b[2] - (a[0] - a[2]));
  return {
    dominant: hex(main),
    secondary: hex(secondary),
    highlight: hex(light[0]),
    shadow: hex(light.at(-1)!.map((value) => value * 0.2)),
    warm: hex(warmth[0]),
    cool: hex(warmth.at(-1)!),
  };
}
export function usePalette(src?: string) {
  const [palette, setPalette] = useState(fallback);
  useEffect(() => {
    if (!src) return;
    const found = cache.get(src);
    if (found) {
      setPalette(found);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const next = extractPalette(image);
        cache.set(src, next);
        if (!cancelled) setPalette(next);
      } catch {
        if (!cancelled) setPalette(fallback);
      }
    };
    image.onerror = () => {
      if (!cancelled) setPalette(fallback);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return palette;
}
