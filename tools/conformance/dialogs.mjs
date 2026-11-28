import { parseHTML } from "linkedom";

export function checkDialogMarkup(html, report) {
  if (!/<dialog[\s/>]/i.test(html)) return;
  const { document } = parseHTML(html);
  for (const dialog of document.querySelectorAll("dialog")) {
    if (!dialog.classList.contains("dlg")) report("unstyledDialog");
  }
}
