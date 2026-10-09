import { createResource, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Image } from "lucide-solid";
import { getImageThumbnail } from "../../services/imageConverter";

export function ImageThumbnail(props: { path: string }) {
  let host!: HTMLDivElement;
  let observer: IntersectionObserver | undefined;
  const [visible, setVisible] = createSignal(false);
  const [thumbnail, { mutate }] = createResource(
    () => visible() ? props.path : undefined,
    (path) => getImageThumbnail(path).catch(() => null),
  );

  onMount(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer?.disconnect();
        setVisible(true);
      }
    }, { rootMargin: "100px" });
    observer.observe(host);
  });
  onCleanup(() => observer?.disconnect());

  return (
    <div ref={host} class="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-lg border border-border/60 bg-secondary/40 overflow-hidden">
      <Show when={thumbnail()} fallback={<Image size={20} class="text-primary/70" aria-hidden="true" />}>
        {(url) => <img src={url()} alt="" class="w-full h-full object-contain" decoding="async" onError={() => mutate(null)} />}
      </Show>
    </div>
  );
}
