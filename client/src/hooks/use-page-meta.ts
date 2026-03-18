import { useEffect } from "react";

interface PageMeta {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

const MANAGED_ATTR = "data-page-meta";
const DEFAULT_TITLE = document.title;

function setMetaTag(attribute: string, key: string, content: string): { attribute: string; key: string; prev: string | null; wasCreated: boolean } {
  let el = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  const wasCreated = !el;
  const prev = el ? el.getAttribute("content") : null;

  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attribute, key);
    el.setAttribute(MANAGED_ATTR, "true");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);

  return { attribute, key, prev, wasCreated };
}

function restoreMetaTag(entry: { attribute: string; key: string; prev: string | null; wasCreated: boolean }) {
  const el = document.querySelector(`meta[${entry.attribute}="${entry.key}"]`) as HTMLMetaElement | null;
  if (!el) return;
  if (entry.wasCreated) {
    el.remove();
  } else if (entry.prev !== null) {
    el.setAttribute("content", entry.prev);
  }
}

export function usePageMeta(meta: PageMeta) {
  useEffect(() => {
    document.title = meta.title;

    const entries: ReturnType<typeof setMetaTag>[] = [];

    if (meta.description) {
      entries.push(setMetaTag("name", "description", meta.description));
    }

    if (meta.ogTitle || meta.title) {
      entries.push(setMetaTag("property", "og:title", meta.ogTitle || meta.title));
    }
    if (meta.ogDescription || meta.description) {
      entries.push(setMetaTag("property", "og:description", (meta.ogDescription || meta.description)!));
    }
    if (meta.ogImage) {
      entries.push(setMetaTag("property", "og:image", meta.ogImage));
    }
    if (meta.ogUrl) {
      entries.push(setMetaTag("property", "og:url", meta.ogUrl));
    }
    entries.push(setMetaTag("property", "og:type", meta.ogType || "website"));

    entries.push(setMetaTag("name", "twitter:card", meta.twitterCard || "summary_large_image"));
    if (meta.twitterTitle || meta.ogTitle || meta.title) {
      entries.push(setMetaTag("name", "twitter:title", meta.twitterTitle || meta.ogTitle || meta.title));
    }
    if (meta.twitterDescription || meta.ogDescription || meta.description) {
      entries.push(setMetaTag("name", "twitter:description", (meta.twitterDescription || meta.ogDescription || meta.description)!));
    }
    if (meta.twitterImage || meta.ogImage) {
      entries.push(setMetaTag("name", "twitter:image", (meta.twitterImage || meta.ogImage)!));
    }

    return () => {
      document.title = DEFAULT_TITLE;
      for (const entry of entries) {
        restoreMetaTag(entry);
      }
    };
  }, [meta.title, meta.description, meta.ogTitle, meta.ogDescription, meta.ogImage, meta.ogUrl, meta.ogType, meta.twitterCard, meta.twitterTitle, meta.twitterDescription, meta.twitterImage]);
}
