import Image, { type ImageProps } from 'next/image';

export default function PreviewImage(props: ImageProps) {
  const src = typeof props.src === 'string' && props.src.startsWith('/images/') ? `/tina-preview${props.src}` : props.src;
  return <Image {...props} src={src} />;
}
