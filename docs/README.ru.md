> [!WARNING]
> This file is a historical implementation scratchpad and contains obsolete
> `window.__TAURI__` experiments. The current extension and security contract is
> documented in [`EXTENSIONS.md`](./EXTENSIONS.md).

<details>

let numberIcon = 1;

console.log(numberIcon--);

function temporary(): void {
eval(`
async function handlePlugin() {
const icon = "E:\\\\Downloads\\\\tauri-app-icon-";
const number = ((numberIcon++) % 4);
const getCurrentWebviewWindow = window.__TAURI__.webviewWindow.getCurrentWebviewWindow;
const defaultWindowIcon = window.__TAURI__.app.defaultWindowIcon;

await getCurrentWebviewWindow().setIcon(
number === 0 ? (await defaultWindowIcon()) : (icon + number + ".png")
);
await getCurrentWebviewWindow().setTitle(
number !== 1 ? (
"Kaede 0." +
Math.floor(Math.random() * 10) +
"." +
Math.floor(Math.random() * 10)
) : (
"💠🥀 Mari :3"
)
);
}

handlePlugin();
`);
}
</details>

<details>
eval(`async function huh() {
  const getCurrentWebviewWindow = window.__TAURI__.webviewWindow.getCurrentWebviewWindow;
  const isDecorated = await getCurrentWebviewWindow().isDecorated();

await getCurrentWebviewWindow().setDecorations(!isDecorated);

const tray = await window.__TAURI__.tray.TrayIcon.new({
tooltip: "Kaede Plugin",
icon: await window.__TAURI__.app.defaultWindowIcon(),
menu: await window.__TAURI__.menu.Menu.new({
items: [
await window.__TAURI__.menu.IconMenuItem.new({
text: "Kaede :3",
icon: window.__TAURI__.menu.NativeIcon.Bluetooth,
}),
await window.__TAURI__.menu.PredefinedMenuItem.new({ item: "Separator" }),
await window.__TAURI__.menu.Submenu.new({
text: "Submenus",
items: [
await window.__TAURI__.menu.Submenu.new({
text: "Another submenu lol",
items: [
await window.__TAURI__.menu.MenuItem.new({
text: "Blur the background",
action: () => {
window.__KAEDE__.libs.GlobalStateHelpers.Layout.overrideBackground({ blur: 8 });
}
}),
await window.__TAURI__.menu.MenuItem.new({
text: "Remove the blur from the background",
action: () => {
window.__KAEDE__.libs.GlobalStateHelpers.Layout.overrideBackground({ blur: null });
}
}),
],
}),
],
}),
await window.__TAURI__.menu.MenuItem.new({
text: "Remove the tray",
action: async () => {
await tray.close();
},
}),
],
}),
})

await tray.setVisible(true);
}

huh();`);
</details>

<details>
eval(`
  function handleNavigation(path) {
    const webviewId = path === "home" ? "main" : \`navigation_window_\$\{path\}\`;
    const sidebarButton = document.getElementById(\`__sidebar__entry-\$\{path\}-button\`);

    sidebarButton.setAttribute("disabled", "");

    new window.__TAURI__.webviewWindow.WebviewWindow(webviewId, {
      "url": \`/?route=\$\{path\}\`,
      "visible": false,
      "title": "Kaede - " + General.capitalize(path),
    });
}

async function temporaryShit() {
window.__KAEDE__.libs.GlobalStateHelpers.Pages.navigate = handleNavigation;

    const currentWebviewWindow = window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
    const obj = {
      "main": "C:\\\\Users\\\\windstone\\\\AppData\\\\Roaming\\\\Kaede\\\\1226538.jpg",
      "navigation_window_library": "C:\\\\Users\\\\windstone\\\\AppData\\\\Roaming\\\\Kaede\\\\thumb-1920-1198959.png",
      "navigation_window_profile": "C:\\\\Users\\\\windstone\\\\AppData\\\\Roaming\\\\Kaede\\\\thumb-1920-1096686.png",
      "navigation_window_add-instance": "C:\\\\Users\\\\windstone\\\\AppData\\\\Roaming\\\\Kaede\\\\blue-archive-anime-girls-hd-wallpaper-preview.jpg",
      "navigation_window_settings": "C:\\\\Users\\\\windstone\\\\AppData\\\\Roaming\\\\Kaede\\\\sorasaki-hina-blue-archive-blue-archive-anime-girls-hd-wallpaper-preview.jpg",
    };

    window.__KAEDE__.libs.GlobalStateHelpers.Layout.overrideBackground({
      "url": window.__TAURI__.core.convertFileSrc(obj[currentWebviewWindow.label]),
    });

    if (currentWebviewWindow.label === "main") {
      return;
    }

    window.__KAEDE__.libs.GlobalStateHelpers.Layout.toggle(["sidebar"]);
}

temporaryShit();
`);
</details>

<details>

```ts
function handleNavigation(path: RouteType): void {
  const webviewId = path === "home" ? "main" : `navigation_window_${path}`;

  new WebviewWindow(webviewId, {
    "url"    : `/?route=${path}`,
    "visible": false,
    "title"  : "Kaede - " + General.capitalize(path),
  });
}

export async function temporaryShit(): Promise<void> {
  window.__KAEDE__.libs.GlobalStateHelpers.Pages.navigate = handleNavigation;

  const currentWebviewWindow = getCurrentWebviewWindow();
  const currentId = currentWebviewWindow.label;

  if (currentId !== "navigationWindow") {
    return;
  }

  document.head.insertAdjacentHTML(
    "beforeend",
    "<style>" +
    "#__sidebar__wrapper {" +
    "display: none" +
    "}" +
    "#__page-wrapper {" +
    "left: 8px" +
    "}" +
    "</style>",
  );
}
```

</details>

A video demonstration of the isolated plugin that renders an interactive Live2D of [Misono Mika](https://bluearchive.wiki/wiki/Mika). Isolated plugin has the access to DOM (`document`); also can use `window.log` (a custom logger function that wraps tauri-plugin-log), `Math`, `Date`, `URL`, `Buffer`, `window["__core-js_shared__"]`, `console`, etc. This list is not full because it is really long, and the key thing here is that we can manually pass down global variables, so important and dangerous `window.__TAURI__.*` functions are not accessible.

Isolation was done using the [Secure ECMAScript](https://github.com/endojs/endo). All globals were frozen using the `lockdown` function that `ses` library provides. So plugins can't rewrite any globals, prototypes, etc.

Interactive Live2Ds were taken from [Z_DK's Steam Workshop](https://steamcommunity.com/id/xingsuileixi/myworkshopfiles/?appid=431960)

<details>
I need to take care of DOM script tags that plugins can add when have the DOM access. Otherwise, this sandbox can be escaped. Maybe I can overwrite the `document.createElement` before freezing it? And just to be sure, listen for `head` element changes for possible script tag additions?

Update: Seems like giving DOM access to the compartment basically ruins the whole purpose of plugin isolation, since one can add a JS code to any DOM element that will be executed in the global scope.

Well, let's make these permissions then?

- Full DOM access
- File System access (window.__TAURI__.fs)
- System shell access (window.__TAURI__.shell)
- ...other Tauri-specific plugins access

How to adapt to these rules? Do I really need compartments here? Isn't it better to just use `new Function` at this point? What to do about script tags and the above DOM element JS executions? Should I expose Tauri API through `window` object? How to import and share Tauri API then?

---

After some thoughts, I decided to go with this approach:

Tauri API **will not** be exposed through `window`

Account sign in is made through another webview window with no plugin access to prevent any possible security vulnerabilities.

- Kaede Add-ons User Repository (KAUR) - plugins that are free to publish for anyone. Will use Secure ECMAScript Compartments for not full DOM access, otherwise they are executed with `new Function`
- Moderated plugins - every plugin publish/update goes through my checks. I only need plugin's source code and build manual. Executed with `new Function` or `Module Federation Runtime API`, have full DOM access by default, only require Tauri API scope permissions (fs, shell, global shortcuts, network, os info, etc.) from user

Permissions:

Runs in compartment:

- CSS: Apply CSS stylesheet                    - Custom
- |    Edit/replace element class list (by id)
- |    Edit element styles (by id)

Runs in `new Function` or Module Federation Runtime API (`eval`):

Note: I need to generalize these, because seeing 30 permissions that vary from doing 1 simple ass thing (tauri-core-app) to doing 50+ dangerous things (tauri-plugin-fs/tauri-plugin-shell) is not ok

- Website capabilities: everything that HTML & JS & CSS offers (no access to Tauri API)
- Tauri Core: Allow to change application theme (not the UI) - App
- |           Emit/listen events to/from the backend         - Event
- |           Create images from paths                       - Image
- |           Menu
- |           Path
- |           Resources
- |           Tray
- |           WebViews & windows management
- Tauri Plugins:
- plugin-drpc (i will format these a bit later)
- plugin-fs
- plugin-http
- plugin-log
- plugin-notification
- plugin-opener
- plugin-os
- plugin-process
- plugin-shell
- plugin-upload

not related, but need to store it somewhere:

context menu has 50000 z-index
log menu     has 40000 z-index
sidebar      has 3000 z-index

Update: apparently, this shit is not going to work because tauri exposes __TAURI_INTERNALS__ to the `window` object. Nothing I can do about it, right?

Update: yeah, `window.__TAURI_INTERNALS__` are frozen. But even if I somehow disable freezing, clone the `window.__TAURI_INTERNALS__.invoke` function, overwrite/delete it, and freeze the whole `window.__TAURI_INTERNALS__`, Tauri will just break since it accesses invokes from `window` (even in rust).

Now I need to make some safe fine-grained permission system that manually exposes some JS capabilities, safe DOM wrappers, app functions and variables, Tauri-specific scopes, and only then the whole unrestricted environment (for DOM and full Tauri API). (Also need to take care of `plugin-shell` that allows to execute `java` with any arguments. Maybe not allow it unless unrestricted environment?)

restricted environment will run in compartments, unrestricted environment is basically a `new Function` or `eval` in case of Module Federation Runtime API.

Also, not related to extensions, but I can implement a `temporary launcher version switcher` that will fetch the JS code, save it in the directory somewhere that JS bindings can't access, and execute it instead of the bundled into the launcher JS assets.
</details>

If there is no video, [click here](https://github.com/user-attachments/assets/a1ccc9f2-0244-437b-8883-a68a26953e2a)

<video src="https://github.com/user-attachments/assets/a1ccc9f2-0244-437b-8883-a68a26953e2a" width="320" height="240" controls></video>

<details>

```typescript
/* App.vue */

(async () => {
  if (!localStorage.getItem("CH0304_home.skel")) {
    localStorage.setItem("CH0304_home.skel", String.raw`{"SettingModel":{"version":5,"skel":"CH0304_home.skel","atlas":"CH0304_home.atlas","eyeTouch":"Touch_Me","idol":"Idle_01","x":459,"y":693,"scale":0.34,"angle":0,"bgmVolume":0.1,"talkVolume":0.45,"showTouch":false,"panelDisplay":false,"showTalkDialog":false,"textX":767,"textY":382,"textSize":16,"autoTalk":0,"resolution":"2k","startAnimation":"Start_Idle_01","startScene":true,"language":"中文"},"EventInfos":[{"BoneName":"Spine_03","Width":1500,"Height":800,"Animations":["Talk_01_M","Talk_02_M","Talk_03_M","Talk_04_M","Talk_05_M"],"AnimationIndex":10,"TextIndex":0,"ClickType":"click","EmptyAnimation":true},{"BoneName":"front hat_03b","Width":800,"Height":500,"Animations":["Pat_01_M"],"AnimationIndex":20,"TextIndex":0,"ClickType":"pointerdown","EmptyAnimation":false}],"AnimationsTexts":{"中文":{"CH0304_MemorialLobby_1_1":"……我想起了第一次拿起画笔的那天。","CH0304_MemorialLobby_1_2":"那时……我单纯地、笔直地面对着画布。","CH0304_MemorialLobby_2_1":"现在的我……已经不一样了。","CH0304_MemorialLobby_2_2":"不知道该画什么，失去了自信……","CH0304_MemorialLobby_3_1":"就在那时，老师告诉了我。","CH0304_MemorialLobby_3_2":"「名为『梦想』的魔法，早已寄宿在你的心里。」","CH0304_MemorialLobby_4_1":"只要还有梦想……接下来就不会在道路上迷失了吧。","CH0304_MemorialLobby_4_2":"老师……如果可以的话，愿意和我一起走这条路吗？","CH0304_MemorialLobby_5":"一条用五彩缤纷的梦想铺成的魔法之路！"},"日本語":{"CH0304_MemorialLobby_1_1":"……はじめて絵を描いた日を、思い出します。","CH0304_MemorialLobby_1_2":"あのときは……まっすぐ、純粋に、キャンバスと向き合っていました。","CH0304_MemorialLobby_2_1":"今の私は……違います。","CH0304_MemorialLobby_2_2":"何を描けばいいのか分からなくなって、自信を失ってしまって……。","CH0304_MemorialLobby_3_1":"そんなとき、マスターが教えてくれたんです。","CH0304_MemorialLobby_3_2":"「夢」という魔法は、もう心の中に宿ってるって。","CH0304_MemorialLobby_4_1":"夢があるなら……これからは、道に迷わずに済みそうです。","CH0304_MemorialLobby_4_2":"マスター……よければ、私と同じ道を歩みませんか？","CH0304_MemorialLobby_5":"色とりどりの夢でいっぱいの、魔法の道を！"},"English":{"CH0304_MemorialLobby_1_1":"...I remember the first day I ever picked up a brush.","CH0304_MemorialLobby_1_2":"Back then... I faced the canvas straight on, with pure heart.","CH0304_MemorialLobby_2_1":"But now... I’m not the same.","CH0304_MemorialLobby_2_2":"I no longer know what to paint, and I’ve lost my confidence...","CH0304_MemorialLobby_3_1":"At that moment, Master told me:","CH0304_MemorialLobby_3_2":"“The magic called ‘dream’ has already taken root inside your heart.”","CH0304_MemorialLobby_4_1":"As long as I have that dream... I won’t lose my way anymore.","CH0304_MemorialLobby_4_2":"Master... if you’d like, would you walk this same path with me?","CH0304_MemorialLobby_5":"A magical road paved with countless, colorful dreams!"},"Tiếng Việt":{"CH0304_MemorialLobby_1_1":".....Em vẫn nhớ ngày đầu tiên, mình bắt đầu vẽ tranh.","CH0304_MemorialLobby_1_2":"Lúc đó.. Em đối diện với khuôn canvas... \nTheo cách chân thành và thuần khiết nhất.","CH0304_MemorialLobby_2_1":"Còn em bây giờ... khác nhiều rồi.","CH0304_MemorialLobby_2_2":"Khi cầm cọ lên, em không biết nên vẽ gì nữa. \nEm mất tự tin về chính bản thân mình.","CH0304_MemorialLobby_3_1":"Và chính khi ấy, \nMaster lại dạy cho em một bài học","CH0304_MemorialLobby_3_2":"“Về phép màu mang tên ''Giấc mơ''.. \nVẫn luôn trú ngụ trong trái tim chúng ta ấy.”","CH0304_MemorialLobby_4_1":"Miễn còn có Giấc mơ... Thì từ giờ trở đi... \nEm không phải lo mình lạc l4_MemorialLobby_4_2":"Master... Nếu người không ngại thì... Hãy cùng em đi chung một lối nhé?","Cối nữa.","CH030H0304_MemorialLobby_5":"Trên con đường ma thuật, Ngập tràn những giấc mơ muôn màu!"}}}`);
  }

  const url = "./assets/index-CQUR_vLf.js";
  const response = await fetch(url);
  const _code = await response.text();
  const _cleaned = _code;
    //.replace("<!--", "<")
    //.replace("-->", ">")
    //.replace("-->", ">");
  const result = await Command.create("java", [
    "--version",
  ]).execute();

  // console.log(result, /* () => _cleaned */);

  // const realm = new ShadowRealm;

  // await realm.importValue("document", "document");

  // realm.evaluate(_cleaned);

  console.log("Hardened Javascript test using SES");

  const t1 = performance.now();

  try {
    console.log("Action: Trying to lockdown every JS globals");
    // lockdown({
    //   "evalTaming": "unsafeEval",
    // });
  } catch {
    console.log("Already locked down");
  }

  // window.Buffer = Buffer;

  const _temporary: object = {};

  for (const _name of Object.getOwnPropertyNames(window)) {
    if (["Infinity", "undefined", "NaN"].includes(_name)) {
      continue;
    }

    if (_name[0] === _name[0].toLowerCase() && typeof window[_name] === "function") {
      _temporary[_name] = window[_name].bind(window);

      continue;
    }

    _temporary[_name] = window[_name];
  }

  console.log("Action: Creating a safe compartment");
  const c = new Compartment({
    "globals": /* _temporary */ {
      ...window,
      "console": {
        ...console,
        "log": log.debug,
        ...log,
      },
      "log"     : log,
      "document": window.document,
      "globalThis": window,
      "location": window.location,
      "Symbol": window.Symbol,
      "Buffer": window.Buffer,
      "MathMLElement": window.MathMLElement,
      "HTMLElement": window.HTMLElement,
      "HTMLDivElement": window.HTMLDivElement,
      "Response": window.Response,
      "TouchEvent": window.TouchEvent,
      "MouseEvent": window.MouseEvent,
      "PointerEvent": window.PointerEvent,
      "global": window,
      "window": window,
      "Date": window.Date,
      "requestAnimationFrame": window.requestAnimationFrame.bind(window),
      "cancelAnimationFrame": window.cancelAnimationFrame.bind(window),
      "XMLHttpRequest": window.XMLHttpRequest,
      "ResizeObserver": window.ResizeObserver,
      "performance": window.performance,
      "ElementPrototype": Element.prototype,
      "HTMLElementPrototype": HTMLElement.prototype,
      "NodePrototype": Node.prototype,
      "EventTargetPrototype": EventTarget.prototype,
      "SVGElement": window.SVGElement,
      "Element": window.Element,
      "WebGLRenderingContext": window.WebGLRenderingContext,
      "WebGL2RenderingContext": window.WebGL2RenderingContext,
      "navigator": window.navigator,
      "Image": window.Image,
      "OffscreenCanvas": window.OffscreenCanvas,
      "Node": window.Node,
      "EventTarget": window.EventTarget,
      "HTMLCanvasElement": window.HTMLCanvasElement,
      "screen": window.screen,
      "fonts": window.document.fonts,
      "dispatchEvent"      : window.dispatchEvent.bind(window),
      "addEventListener"   : window.addEventListener.bind(window),
      "removeEventListener": window.removeEventListener.bind(window),
      "HTMLInputElement": window.HTMLInputElement,
      "CanvasRenderingContext2D": window.CanvasRenderingContext2D,
      "CanvasGradient": window.CanvasGradient,
      "CanvasPattern": window.CanvasPattern,
      "ImageData": window.ImageData,
      "TextMetrics": window.TextMetrics,
      "Path2D": window.Path2D,
      "ImageBitmapRenderingContext": window.ImageBitmapRenderingContext,
      "__core-js_shared__": window["__core-js_shared__"],
      "fetch"   : (...args: [RequestInfo]) => fetch(...args),
      "ImageBitmap": window.ImageBitmap,
      HTMLImageElement: window.HTMLImageElement,
      HTMLVideoElement: window.HTMLVideoElement,
      Blob: window.Blob,
      File: window.File,
      ArrayBuffer: window.ArrayBuffer,
      Uint8Array: window.Uint8Array,
      Int8Array: window.Int8Array,
      Uint8ClampedArray: window.Uint8ClampedArray,
      Uint16Array: window.Uint16Array,
      "Int16Array": window.Int16Array,
      Uint32Array: window.Uint32Array,
      Int32Array: window.Int32Array,
      Float32Array: window.Float32Array,
      DataView: window.DataView,
      XMLDocument: window.XMLDocument,
      "Math": window.Math,
      URL: {
        ...window.URL,
        createObjectURL: URL.createObjectURL.bind(URL),
        revokeObjectURL: URL.revokeObjectURL.bind(URL),
      },
      createImageBitmap: window.createImageBitmap.bind(window),
      setInterval: window.setInterval.bind(window),
      setTimeout: window.setTimeout.bind(window),
      clearInterval: window.clearInterval.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      FontFace: window.FontFace,
    },
    "__options__": true,
  });

  const t2 = performance.now();

  console.log("Action: Running the contained code");
  try {
    // await c.evaluate(_cleaned);
    eval(_cleaned);
  } catch (error) {
    console.error("Error in the container:", error);
  }

  log.debug("Initializing launcher");
  await finalizeInitialization({ config, baseDirectory, startTime }).catch((error: unknown) => {
    log.error("Failed to initialize launcher:", JSON.stringify(error));
  });

  const t3 = performance.now();
  console.log("Locking down & hardening done in", t2 - t1, "ms\n", "Secure ECMAScript evaluation done in", t3 - t2, "ms");

  // const __invoke = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__); // or `{}`?
  // console.log(window.__TAURI_INTERNALS__);

  // window.__TAURI_INTERNALS__.invoke = (): void => {};

  console.log("Evaluating...");
  log.debug("Evaluating...");
  (new Function(`
    console.log(window.__TAURI_INTERNALS__);
    window.__TAURI_INTERNALS__.invoke("plugin:log|log", {
      level: 4,
      message: 'Wow!',
      location: '',
      file: '',
      line: 1,
      keyValues: { "": "" }
    })
  `))();
})();
```

```typescript
/* globals.css */

/*
 * TODO: these are live2d plugin-related styles
 *
.loading-container, .loading-image, .el-scrollbar {
   display: none !important;
}
 */

/*
(async () => {
  if (HookMappings.page !== "onRouteChange") {
    return;
  }

  try {
    const wrapper = document.createElement("div");

    wrapper.setAttribute("id", "blue_archive");
    wrapper.setAttribute("style", "position:absolute;top:0;left:0;right:0;bottom:0");

    document.body.append(wrapper);

    const response = await fetch("./assets/index-CQUR_vLf.js");
    const code = await response.text();
    const plugin = new Function(code);

    const __globalStates = window[ApplicationNamespace].functions.getGlobalStates();

    window[ApplicationNamespace].functions.changeGlobalStates("sidebarItems", [
      ...__globalStates.sidebarItems,
      {
        "path"  : "none",
        "icon"  : "i-lucide-rss",
        "name"  : "via plugin!",
        "action": () => window[ApplicationNamespace].functions.changeGlobalStates("page", "none"),
      },
    ]);

    plugin();

    setTimeout(() => {
      const __appWrapper = document.getElementById("app_wrapper");
      const __sidebar = document.getElementById("sidebar");
      const __sidebarPlaceholder = document.getElementById("sidebar__placeholder");
      const __sidebarItems = document.getElementsByName("sidebar__item");
      const __sidebarTexts = document.getElementsByName("sidebar__item_text");

      if (__sidebar !== null && __appWrapper !== null && __sidebarPlaceholder !== null) {
        __sidebar.className = "transition-all h-58 w-16 absolute top-4 left-4 rounded-md overflow-hidden gap-2 flex flex-col bg-[theme(colors.black/.5)] p-2";
        __sidebarPlaceholder.className = "h-vh w-24 transition-[width]";

        for (const __item of __sidebarItems) {
          __item.className = "relative size-12 flex flex-col rounded-md select-none items-center justify-center gap-1 text-white transition-[width,height,background-color] duration-150 disabled:bg-[theme(colors.black/.3)]";
        }

        for (const __item of __sidebarTexts) {
          __item.className = "hidden";
        }
      }
    }, 300);
  } catch (error) {
    console.error(error);
  }
})();
<link rel="stylesheet" crossorigin href="./assets/index-CsDBtkr9.css">
 */

/*
(async () => {
  console.log("trying");

  try {
    const { discord } = window.__TAURI_PLUGINS_COMMUNITY__;

    await discord.stop();
    await discord.start("1432010035034325105");

    const assets = new discord.Assets()
      .setLargeImage("misono_mika")
      .setLargeText("Misono Mika");

    const activity = new discord.Activity()
      .setState("Tauri & Vue <3")
      .setAssets(assets)
      .setTimestamps(new discord.Timestamps(Date.now()))
      .setButton([
        new discord.Button("Minecraft Launcher w/ plugins", "https://github.com/kaede-basement/kaede"),
      ]);

    await discord.setActivity(activity);
  } catch (error) {
    console.error("setting", error);
  }
})();
 */
```

</details>
