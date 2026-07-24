/// <reference path="../../kaede-sandbox.d.ts" />

const safeDocument = scopedThis["ui/basic"];

if (safeDocument) {
  const message = safeDocument.createParagraph();

  message.setText("Hello from a sandboxed plugin");
  safeDocument.appendChild(message);
}

void (async () => {
  const grant = await requestPermissions([
    {
      "id"   : "network/http",
      "scope": {
        "origins": ["https://api.example.com"],
        "methods": ["GET"],
      },
    },
  ]);

  if (grant.granted.includes("network/http")) {
    await grant.capabilities["network/http"]?.fetch({
      "url"    : "https://api.example.com/status",
      "method" : "GET",
      "headers": [],
    });
  }
})();

void (async () => {
  const processCapability = await scopedThis["system/process/spawn"]?.spawn({
    "path"     : "/bin/test",
    "arguments": [],
  });

  // @ts-expect-error Plugin process handles do not expose stdin writes.
  await processCapability?.write("input");
})();

// @ts-expect-error Sandboxed plugins do not receive the trusted Host facade.
scopedThis.Host;

// @ts-expect-error Sandboxed plugins do not receive the trusted DirectHost facade.
scopedThis.DirectHost;

// @ts-expect-error Sandboxed plugins do not receive the mutable Kaede namespace.
scopedThis.Kaede;

// @ts-expect-error Txiki is a trusted Kaede helper, not a sandbox capability.
scopedThis.Txiki;

// @ts-expect-error Sandboxed plugins cannot access the trusted bootstrap alias.
window.__KAEDE__;

// @ts-expect-error Sandboxed plugins cannot access application internals.
window.__KAEDE_INTERNALS__;

// @ts-expect-error Sandboxed plugins do not receive Kaede's bundler bootstrap name.
__PRE_BUNDLED_FILENAME__;
