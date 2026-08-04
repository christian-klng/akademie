import type { Media } from "@/lib/schema";

// The browser's own <video> element is the player — no library. A library
// would only earn its weight with adaptive streaming (HLS), which we don't do.
//
// `preload="metadata"` fetches just the header, so a page with a video doesn't
// pull megabytes before anyone presses play. No autoplay: it eats visitors'
// data and the site is read, not watched at.
export function VideoPlayer({
  video,
  className,
}: {
  video: Media;
  className?: string;
}) {
  return (
    <video
      controls
      preload="metadata"
      playsInline
      // <video> has no alt attribute — aria-label is what gives it a name for
      // screen readers. Without alt text the title is still better than nothing.
      aria-label={video.altText || video.title}
      poster={video.posterId ? `/api/media/${video.posterId}` : undefined}
      className={`w-full rounded-xl bg-neutral-900 shadow-sm ${className ?? ""}`}
    >
      <source src={`/api/media/${video.id}`} type={video.mimeType} />
      <p className="p-4 text-sm text-white">
        Dein Browser kann dieses Video nicht abspielen.{" "}
        <a href={`/api/media/${video.id}`} className="underline">
          Video herunterladen
        </a>
      </p>
    </video>
  );
}
