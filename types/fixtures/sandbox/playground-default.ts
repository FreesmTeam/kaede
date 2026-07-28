/// <reference path="../../kaede-sandbox.d.ts" />

const safeDocument = scopedThis["ui/basic"];

if (safeDocument) {
  const message = safeDocument.createParagraph();

  message.setText("Hello from a sandboxed plugin");
  safeDocument.appendChild(message);
}
