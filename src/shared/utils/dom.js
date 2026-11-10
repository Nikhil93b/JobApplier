import { safeUrl } from "./match.mjs";

export const $ = (id) => document.getElementById(id);

export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function message(text) {
  $("message").textContent = text;
}

export function link(url, text) {
  const a = el("a", text, "button secondary");
  const valid = safeUrl(url);
  if (!valid) return el("span", "Application link unavailable", "small");
  a.href = valid;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

export function plainDescription(html) {
  let text = html;
  for (let i = 0; i < 2; i++) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    doc
      .querySelectorAll("script,style,iframe,img")
      .forEach((node) => node.remove());
    doc
      .querySelectorAll("p,div,li,br,h1,h2,h3")
      .forEach((node) => node.append(doc.createTextNode("\n")));
    text = doc.body.textContent || "";
  }
  return text.trim();
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
