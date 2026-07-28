/// <reference path="../../kaede-trusted.d.ts" />

const { Host, DirectHost, Kaede } = scopedThis;

void Host.files.readText("config.json5");
void DirectHost.app.version();
void Kaede.libs;

const downloadWithProgress = Kaede.libs.Launcher.Fetching.downloadWithProgress;

void downloadWithProgress({
  "url"     : "https://example.test/client.jar",
  "path"    : "libraries/client.jar",
  "statuses": {} as Parameters<typeof downloadWithProgress>[0]["statuses"],
});

const validationErrors = Kaede.libs.Schemas.AccountValidator.Errors({});

void validationErrors.then(errors => errors.length);
// @ts-expect-error Validation errors are loaded asynchronously outside the startup bundle.
void validationErrors.length;

const txiki = new Kaede.libs.Txiki;

void txiki.get("/status", ({ params }) => params).listen();

// @ts-expect-error Trusted plugins are not injected with sandbox permission requests.
requestPermissions(["logging/write"]);
