(() => {
"use strict";

const editor = document.getElementById("editor");
const list = document.getElementById("documentOutlineList");
const empty = document.getElementById("documentOutlineEmpty");
let pendingFrame = null;

function updateOutline() {
  pendingFrame = null;
  const fragment = document.createDocumentFragment();
  const headings = editor.querySelectorAll(
    ".md-heading-1,.md-heading-2,.md-heading-3,.md-heading-4,.md-heading-5,.md-heading-6"
  );
  headings.forEach((heading, index) => {
    const level = Array.from(heading.classList).find(name => /^md-heading-[1-6]$/.test(name)).slice(-1);
    const label = heading.cloneNode(true);
    label.querySelectorAll(".md-marker").forEach(marker => marker.remove());
    label.querySelectorAll(".math-token").forEach(token => {
      token.textContent = token.dataset.source || token.textContent;
    });
    heading.id = "document-heading-" + index;
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "outline-link";
    link.href = "#" + heading.id;
    link.style.setProperty("--outline-depth", Number(level) - 1);
    link.textContent = label.textContent.trim() || "Titre sans texte";
    link.addEventListener("click", event => {
      event.preventDefault();
      heading.scrollIntoView({block:"start", behavior:"auto"});
      editor.focus({preventScroll:true});
      const range = document.createRange();
      range.selectNodeContents(heading);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    item.appendChild(link);
    fragment.appendChild(item);
  });
  list.replaceChildren(fragment);
  empty.hidden = headings.length > 0;
}

// Observe content changes, including imports, edits and document switches.
// Attribute changes (caret styling and generated IDs) do not rebuild the outline.
new MutationObserver(() => {
  if (pendingFrame === null) pendingFrame = requestAnimationFrame(updateOutline);
}).observe(editor, {childList:true, characterData:true, subtree:true});
updateOutline();
})();
