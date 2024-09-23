import type { WATcloudStaticImage } from "@/build/fixtures/images";
import { getImageBlurSvg } from "@/lib/image-blur-svg";
import { shimmer, toBase64 } from "@/lib/utils";

/**
 * Renders an image component with multiple sources and an alt text.
 * This is useful for serving images in multiple formats. For example,
 * you can serve an image in AVIF, WebP, and PNG formats and the browser
 * will choose the best format to use.
 * @param srcs - An array of image source URLs.
 * @param alt - The alternative text for the image.
 * @returns The rendered Picture component.
 */
export default function Picture({
  image,
  alt,
  wrapperClassName = "",
  imgClassName = "",
  style = {},
}: {
  image: WATcloudStaticImage;
  alt: string;
  wrapperClassName?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
}) {
  // The blur logic is derived from https://github.com/vercel/next.js/blob/98be3ba23ea65ac5b581999d79a1093f147b46f0/packages/next/src/shared/lib/get-img-props.ts
  
  // blurDataURL is a base64-encoded string generated by the nextjs image loader
  // This is only generated during production builds, and is set to a (broken) URL starting with "/_next"
  // during development. In that case, we use a placeholder SVG instead.
  const blurDataURL = (image.jpg.blurDataURL || "/_next").startsWith("/_next") ? `data:image/svg+xml;base64,${toBase64(shimmer(image.jpg.width, image.jpg.height))}` : image.jpg.blurDataURL as string;

  const backgroundImage = `url("data:image/svg+xml;charset=utf-8,${getImageBlurSvg(
    {
      widthInt: image.jpg.width,
      heightInt: image.jpg.height,
      blurWidth: image.jpg.blurWidth,
      blurHeight: image.jpg.blurHeight,
      blurDataURL,
    }
  )}")`;

  const placeholderStyle = {
    // This is `cover` because the blur image can have a different aspect ratio
    // E.g. an image with 1792 × 1024 px can have a blur image with 240 x 150 px
    // This may be due to some implementation details in the next/image loader
    backgroundSize: "cover",
    backgroundPosition: "50% 50%",
    backgroundRepeat: "no-repeat",
    backgroundImage,
  };

  return (
    <picture className={wrapperClassName}>
      <source srcSet={image.avif.src} type="image/avif" />
      <source srcSet={image.webp.src} type="image/webp" />
      <img
        src={image.jpg.src}
        alt={alt}
        width={image.avif.width}
        height={image.avif.height}
        decoding="async"
        loading="lazy"
        className={imgClassName}
        style={{...style, ...placeholderStyle}}
      />
    </picture>
  );
}
