import { StateEffect } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";

export type MediaKind = "image" | "video" | "audio";

/**
 * Where a media widget sits. For `![alt](url)`, "inline" replaces the Markdown and "above" sits
 * on its own row above it while the cursor is on it. For a link to a media file, "after" is the
 * show/hide icon right after the link, and "below" is the file itself, at the end of its line.
 */
export type MediaPlacement = "inline" | "above" | "after" | "below";

/** Asks live preview to rebuild its decorations when something outside the document changed. */
export const redrawPreview = StateEffect.define<null>();

// Media the user showed or hid this session, by URL, so the choice survives redraws.
export const mediaChoices = new Map<string, boolean>();

const embeddedMedia = /^data:(?:image\/(?:png|gif|jpe?g|webp)|video\/(?:mp4|webm|ogg)|audio\/(?:mpeg|mp4|wav|ogg|webm));/i;

/** The URL if live preview may load it: a web address, or media embedded as a data URL. */
export function safeMediaUrl(value: string): string | null {
  if (embeddedMedia.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

const fileExtensions: [MediaKind, RegExp][] = [
  ["image", /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i],
  ["video", /\.(?:mp4|m4v|webm|ogv|mov)$/i],
  ["audio", /\.(?:mp3|m4a|wav|ogg|oga|opus|flac|aac)$/i],
];

/**
 * What a URL points to, going by its data type or file extension. Asking the server would
 * tell it the reader's IP address, so a URL without a telling extension returns null.
 */
export function mediaKindOf(src: string): MediaKind | null {
  const embedded = /^data:(image|video|audio)\//i.exec(src)?.[1];
  if (embedded) return embedded.toLowerCase() as MediaKind;
  try {
    const { pathname } = new URL(src);
    return fileExtensions.find(([, pattern]) => pattern.test(pathname))?.[0] ?? null;
  } catch {
    return null;
  }
}

// CodeMirror re-measures line heights only when the content's height changes, and a short note
// is stretched to fill the editor, so newly loaded media can leave clicks beside it landing on
// the wrong line. Each load bumps this and redraws: widgets built before it count as changed
// (keeping their DOM), which makes CodeMirror measure again.
let mediaLoads = 0;

function mediaSizeChanged(view: EditorView): void {
  mediaLoads += 1;
  if (view.dom.isConnected) view.dispatch({ effects: redrawPreview.of(null) });
}

// Lucide icons (ISC license), built without React inside the editor.
type IconNode = [tag: string, attributes: Record<string, string>][];
const showIcons: Record<MediaKind, IconNode> = {
  image: [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }],
    ["circle", { cx: "9", cy: "9", r: "2" }],
    ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }],
  ],
  video: [
    ["path", { d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" }],
    ["rect", { x: "2", y: "6", width: "14", height: "12", rx: "2" }],
  ],
  audio: [
    ["path", { d: "M9 18V5l12-2v13" }],
    ["circle", { cx: "6", cy: "18", r: "3" }],
    ["circle", { cx: "18", cy: "16", r: "3" }],
  ],
};
const hideIcon: IconNode = [
  ["path", { d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" }],
  ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242" }],
  ["path", { d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" }],
  ["path", { d: "m2 2 20 20" }],
];

function iconElement(nodes: IconNode): SVGSVGElement {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  const attributes = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  };
  for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
  for (const [tag, childAttributes] of nodes) {
    const child = document.createElementNS(svgNamespace, tag);
    for (const [name, value] of Object.entries(childAttributes)) child.setAttribute(name, value);
    svg.append(child);
  }
  return svg;
}

const kindNames: Record<MediaKind, string> = { image: "Image", video: "Video", audio: "Audio" };

/** An image, video or audio player that its icon swaps with a link, and back. */
export class MediaWidget extends WidgetType {
  readonly loads = mediaLoads;

  constructor(
    readonly src: string,
    readonly label: string,
    readonly kind: MediaKind,
    readonly shown: boolean,
    readonly placement: MediaPlacement,
  ) {
    super();
  }

  override eq(other: MediaWidget): boolean {
    return this.sameMedia(other) && this.placement === other.placement && this.loads === other.loads;
  }

  private sameMedia(other: MediaWidget): boolean {
    return this.src === other.src && this.label === other.label && this.kind === other.kind && this.shown === other.shown;
  }

  // Keep loaded media when only its layout or measurement changed, so it doesn't reload.
  override updateDOM(dom: HTMLElement, _view: EditorView, from: MediaWidget): boolean {
    const onlyLayoutChanged = this.shown && [this.placement, from.placement].every((placement) => placement === "inline" || placement === "above");
    if (!this.sameMedia(from) || (this.placement !== from.placement && !onlyLayoutChanged)) return false;
    if (this.placement !== "after") dom.classList.toggle("cm-live-media-block", this.placement !== "inline");
    return true;
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("span");
    if (this.placement === "after") {
      // The link in front of it already names the file.
      wrapper.className = "cm-live-media-after";
      wrapper.append(this.toggleButton(view));
      return wrapper;
    }
    wrapper.className = `cm-live-media ${this.shown ? "cm-live-media-shown" : "cm-live-media-hidden"}`;
    if (this.placement !== "inline") wrapper.classList.add("cm-live-media-block");
    if (this.shown) this.showMedia(wrapper, view);
    else this.showLink(wrapper, view);
    return wrapper;
  }

  private get source(): string {
    if (this.src.startsWith("data:")) return "embedded";
    try {
      return new URL(this.src).host;
    } catch {
      return ""; // safeMediaUrl only lets valid URLs through.
    }
  }

  private toggleButton(view: EditorView): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-live-media-toggle";
    const label = this.shown ? `Hide ${this.kind}` : `Show ${this.kind} from ${this.source}`;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.append(iconElement(this.shown ? hideIcon : showIcons[this.kind]));
    button.addEventListener("click", () => {
      mediaChoices.set(this.src, !this.shown);
      view.dispatch({ effects: redrawPreview.of(null) });
    });
    return button;
  }

  // Web media reveals the reader's IP address to its host, so it can stay as a link.
  private showLink(wrapper: HTMLElement, view: EditorView): void {
    const link = document.createElement("span");
    link.className = "cm-live-media-link";
    link.title = this.src;
    const label = document.createElement("span");
    label.className = "cm-live-media-label";
    label.textContent = `${this.label || kindNames[this.kind]} · ${this.source}`;
    link.append(this.toggleButton(view), label);
    wrapper.append(link);
  }

  private showMedia(wrapper: HTMLElement, view: EditorView): void {
    let media: HTMLImageElement | HTMLMediaElement;
    if (this.kind === "image") {
      const image = document.createElement("img");
      image.alt = this.label;
      image.referrerPolicy = "no-referrer";
      // The line's height changes once the image arrives.
      image.addEventListener("load", () => mediaSizeChanged(view));
      media = image;
    } else {
      const player = document.createElement(this.kind);
      player.controls = true;
      player.preload = "metadata";
      // A video's height is known once its metadata arrives.
      player.addEventListener("loadedmetadata", () => mediaSizeChanged(view));
      media = player;
    }
    media.src = this.src;
    media.title = this.label;
    media.addEventListener("error", () => {
      media.replaceWith(`${this.label || kindNames[this.kind]} failed to load`);
      wrapper.classList.add("cm-live-media-broken");
      mediaSizeChanged(view);
    });
    // Below a link, the icon after the link shows and hides it.
    if (this.placement === "below") wrapper.append(media);
    else wrapper.append(this.toggleButton(view), media);
  }

  // The toggle and player controls handle their own clicks; anything else moves the cursor here.
  override ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.closest(".cm-live-media-toggle, video, audio") !== null;
  }
}
