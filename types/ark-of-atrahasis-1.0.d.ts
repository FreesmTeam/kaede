//#region src/errors.d.ts
type SafeDOMErrorCode = "INVALID_ROOT" | "ROOT_ALREADY_CLAIMED" | "CROSS_OWNER" | "DUPLICATE_REGISTRATION" | "DUPLICATE_IDENTIFIER" | "OWNER_DOCUMENT_MISMATCH" | "ERR_INVALID_ARGUMENT" | "ERR_INVALID_HARDENER" | "ERR_INVALID_POLICY" | "ERR_URL_DENIED" | "FORM_CONTROL_POLICY_REQUIRED" | "DOCUMENT_DISPOSED" | "NODE_DISPOSED" | "NODE_REVOKED" | "PLACEMENT_VIOLATION" | "DOM_OPERATION_FAILED";
interface SafeDOMError {
  readonly name: "SafeDOMError";
  readonly code: SafeDOMErrorCode;
  readonly operation: string;
  readonly message: string;
}
/** Recognize the stable record without consulting getters or prototypes. */
declare function isSafeDOMError(value: unknown): value is SafeDOMError;
//#endregion
//#region src/url-policy.d.ts
declare const URL_SINKS: readonly ["anchor.href", "image.src", "video.src", "video.poster", "audio.src", "source.src", "track.src"];
type URLSink = (typeof URL_SINKS)[number];
type URLProtocol = "https:" | "http:";
interface URLSinkPolicy {
  /** Exact origins after URL canonicalization, including any non-default port. */
  readonly allowedOrigins: readonly string[];
  /** Defaults to https only. */
  readonly allowedProtocols?: readonly URLProtocol[];
  /** Userinfo is denied unless explicitly enabled. */
  readonly allowCredentials?: boolean;
  /** Query strings are denied unless explicitly enabled. */
  readonly allowQuery?: boolean;
  /** Fragments are denied unless explicitly enabled. */
  readonly allowFragment?: boolean;
  /** Defaults to 2048 canonical URL code units. */
  readonly maxLength?: number;
}
interface SafeURLPolicy {
  /** Explicit, host-selected base. document.baseURI is never consulted. */
  readonly baseURL: string;
  /** A missing sink is denied. */
  readonly sinks: Readonly<Partial<Record<URLSink, URLSinkPolicy>>>;
}
type SafeURLDecision = Readonly<{
  allowed: true;
  url: string;
}> | Readonly<{
  allowed: false;
  error: SafeDOMError;
}>;
interface URLPolicyEngine {
  readonly decide: (sink: URLSink, input: unknown) => SafeURLDecision;
}
type URLConstructor = new (url: string, base?: string | URL) => URL;
/**
 * Compile a declarative, per-sink URL policy. With no policy every sink is
 * denied. For an enabled sink, each runtime input is passed to the captured URL
 * constructor exactly once and only that canonical result reaches the caller.
 *
 * URLImpl is an explicit test/realm hook; production callers should omit it or
 * pass the root owner's captured URL constructor.
 */
declare function createURLPolicy(policy?: SafeURLPolicy, URLImpl?: URLConstructor): URLPolicyEngine;
//#endregion
//#region src/style-policy.d.ts
/**
 * CSS properties whose value grammars can be handled through the CSSOM without
 * granting raw declaration/rule access. Host policy still has to opt in to
 * every property; this list is only the outer, library-defined ceiling.
 */
declare const SAFE_STYLE_PROPERTIES: readonly ["accent-color", "align-items", "align-self", "animation-delay", "animation-direction", "animation-fill-mode", "animation-iteration-count", "animation-timing-function", "appearance", "aspect-ratio", "background-color", "block-size", "border-bottom-color", "border-bottom-left-radius", "border-bottom-right-radius", "border-bottom-style", "border-bottom-width", "border-block-end-color", "border-block-end-style", "border-block-end-width", "border-block-start-color", "border-block-start-style", "border-block-start-width", "border-color", "border-end-end-radius", "border-end-start-radius", "border-inline-end-color", "border-inline-end-style", "border-inline-end-width", "border-inline-start-color", "border-inline-start-style", "border-inline-start-width", "border-left-color", "border-left-style", "border-left-width", "border-radius", "border-right-color", "border-right-style", "border-right-width", "border-style", "border-start-end-radius", "border-start-start-radius", "border-top-color", "border-top-left-radius", "border-top-right-radius", "border-top-style", "border-top-width", "border-width", "bottom", "box-shadow", "caret-color", "clip-path", "column-count", "column-gap", "color", "contain", "container-type", "cursor", "flex-basis", "flex-direction", "flex-grow", "flex-shrink", "flex-wrap", "font-size", "font-variant", "gap", "grid-column", "grid-row", "grid-template-columns", "grid-template-rows", "height", "hyphens", "inline-size", "inset-block-end", "inset-block-start", "inset-inline-end", "inset-inline-start", "isolation", "justify-content", "justify-self", "left", "letter-spacing", "line-height", "margin-bottom", "margin-block-end", "margin-block-start", "margin-inline-end", "margin-inline-start", "margin-left", "margin-right", "margin-top", "max-height", "max-block-size", "max-inline-size", "max-width", "min-height", "min-block-size", "min-inline-size", "min-width", "mix-blend-mode", "object-fit", "object-position", "opacity", "order", "outline-color", "outline-offset", "outline-style", "outline-width", "overflow", "overflow-wrap", "overflow-x", "overflow-y", "padding-bottom", "padding-block-end", "padding-block-start", "padding-inline-end", "padding-inline-start", "padding-left", "padding-right", "padding-top", "pointer-events", "position", "resize", "right", "row-gap", "scroll-behavior", "scroll-margin-bottom", "scroll-margin-top", "scroll-padding-bottom", "scroll-padding-top", "text-align", "text-decoration", "text-indent", "text-overflow", "text-transform", "top", "touch-action", "transform", "transition", "user-select", "vertical-align", "visibility", "white-space", "width", "will-change", "word-break", "word-spacing", "z-index"];
type SafeStyleProperty = (typeof SAFE_STYLE_PROPERTIES)[number];
interface SafeStylePolicy {
  /** Canonical kebab-case properties granted to guest wrappers. */
  readonly allowedProperties: readonly SafeStyleProperty[];
}
/** Internal, compiled policy. Its mutable Set is retained only in this closure. */
interface StylePolicyEngine {
  readonly allows: (property: SafeStyleProperty) => boolean;
}
/**
 * Convert the supported CSS spelling or its CSSStyleDeclaration camel-case
 * spelling to one canonical kebab-case property. No trimming, coercion, custom
 * properties, vendor aliases, or arbitrary CSSOM member names are accepted.
 */
declare function canonicalizeStyleProperty(value: unknown): SafeStyleProperty | undefined;
/** Compile a host policy. An omitted policy deliberately grants no properties. */
declare function createStylePolicy(policy?: SafeStylePolicy): StylePolicyEngine;
//#endregion
//#region src/vocabularies.d.ts
/** Frozen single sources of truth for every public keyword vocabulary. */
declare const HEADING_LEVELS: readonly [1, 2, 3, 4, 5, 6];
type HeadingLevel = (typeof HEADING_LEVELS)[number];
declare const FORMATTING_TAGS: readonly ["strong", "em", "small", "b", "i", "u", "code", "kbd", "samp", "var", "sub", "sup", "mark", "abbr", "cite"];
type FormattingTag = (typeof FORMATTING_TAGS)[number];
declare const LIST_TYPES: readonly ["unordered", "ordered", "description"];
type ListType = (typeof LIST_TYPES)[number];
declare const INPUT_TYPES: readonly ["text", "search", "tel", "url", "email", "date", "month", "week", "time", "datetime-local", "number", "range", "color", "checkbox", "radio"];
type InputType = (typeof INPUT_TYPES)[number];
declare const BUTTON_TYPES: readonly ["button"];
type ButtonType = (typeof BUTTON_TYPES)[number];
declare const AUTOCOMPLETE_VALUES: readonly ["off"];
type AutocompleteValue = (typeof AUTOCOMPLETE_VALUES)[number];
declare const DIR_VALUES: readonly ["ltr", "rtl", "auto"];
type DirValue = (typeof DIR_VALUES)[number];
declare const INPUT_MODE_VALUES: readonly ["none", "text", "decimal", "numeric", "tel", "search", "email", "url"];
type InputModeValue = (typeof INPUT_MODE_VALUES)[number];
declare const ENTER_KEY_HINT_VALUES: readonly ["enter", "done", "go", "next", "previous", "search", "send"];
type EnterKeyHintValue = (typeof ENTER_KEY_HINT_VALUES)[number];
declare const TEXTAREA_WRAP_VALUES: readonly ["soft", "hard"];
type TextareaWrapValue = (typeof TEXTAREA_WRAP_VALUES)[number];
declare const IMAGE_LOADING_VALUES: readonly ["eager", "lazy"];
type ImageLoadingValue = (typeof IMAGE_LOADING_VALUES)[number];
declare const TRACK_KINDS: readonly ["subtitles", "captions", "descriptions", "chapters", "metadata"];
type TrackKind = (typeof TRACK_KINDS)[number];
declare const TABLE_SCOPE_VALUES: readonly ["row", "col", "rowgroup", "colgroup"];
type TableScopeValue = (typeof TABLE_SCOPE_VALUES)[number];
declare const ARIA_IDREF_NAMES: readonly ["activedescendant", "details", "errormessage"];
type AriaIdRefName = (typeof ARIA_IDREF_NAMES)[number];
declare const ARIA_IDREF_LIST_NAMES: readonly ["controls", "describedby", "flowto", "labelledby", "owns"];
type AriaIdRefListName = (typeof ARIA_IDREF_LIST_NAMES)[number];
declare const ARIA_ROLES: readonly ["alert", "alertdialog", "application", "article", "banner", "blockquote", "button", "caption", "cell", "checkbox", "code", "columnheader", "combobox", "complementary", "contentinfo", "definition", "deletion", "dialog", "directory", "document", "emphasis", "feed", "figure", "form", "generic", "grid", "gridcell", "group", "heading", "img", "insertion", "link", "list", "listbox", "listitem", "log", "main", "marquee", "math", "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "meter", "navigation", "none", "note", "option", "paragraph", "presentation", "progressbar", "radio", "radiogroup", "region", "row", "rowgroup", "rowheader", "scrollbar", "search", "searchbox", "separator", "slider", "spinbutton", "status", "strong", "subscript", "superscript", "switch", "tab", "table", "tablist", "tabpanel", "term", "textbox", "time", "timer", "toolbar", "tooltip", "tree", "treegrid", "treeitem"];
type AriaRole = (typeof ARIA_ROLES)[number];
declare const SPECIALIZED_ELEMENT_KINDS: readonly ["input", "textarea", "select", "option", "optgroup", "button", "label", "fieldset", "image", "anchor", "video", "audio", "source", "track", "canvas", "th", "td", "details", "dialog", "progress", "meter", "list", "description-list"];
type SpecializedElementKind = (typeof SPECIALIZED_ELEMENT_KINDS)[number];
//#endregion
//#region src/types.d.ts
type SafeEventKind = "generic" | "keyboard" | "mouse" | "pointer" | "touch" | "focus" | "input";
interface SafeEventTargetSnapshot {
  /** Logical local ID for an active owned target; empty for foreign/terminal targets. */
  readonly id: string;
  /** Present only for an active owned branded standard form control. */
  readonly value?: string;
  /** Present only for an active owned branded HTMLInputElement. */
  readonly checked?: boolean;
}
interface SafeEventBase<Kind extends SafeEventKind> {
  readonly kind: Kind;
  readonly type: string;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly composed: boolean;
  readonly defaultPrevented: boolean;
  readonly eventPhase: number;
  readonly timeStamp: number;
  readonly target: SafeEventTargetSnapshot;
  readonly currentTarget: SafeEventTargetSnapshot;
  /** Returns false once the synchronous handler invocation has ended. */
  readonly preventDefault: () => boolean;
  /** Returns false once the synchronous handler invocation has ended. */
  readonly stopPropagation: () => boolean;
  /** Returns false once the synchronous handler invocation has ended. */
  readonly stopImmediatePropagation: () => boolean;
}
interface SafeModifierSnapshot {
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
}
interface SafeGenericEvent extends SafeEventBase<"generic"> {}
interface SafeKeyboardEvent extends SafeEventBase<"keyboard">, SafeModifierSnapshot {
  readonly key: string;
  readonly code: string;
  readonly location: number;
  readonly repeat: boolean;
  readonly isComposing: boolean;
}
interface SafeMouseEvent extends SafeEventBase<"mouse">, SafeModifierSnapshot {
  readonly screenX: number;
  readonly screenY: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly movementX: number;
  readonly movementY: number;
  readonly button: number;
  readonly buttons: number;
  readonly relatedTarget: SafeEventTargetSnapshot | null;
}
interface SafePointerEvent extends SafeEventBase<"pointer">, SafeModifierSnapshot {
  readonly screenX: number;
  readonly screenY: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly movementX: number;
  readonly movementY: number;
  readonly button: number;
  readonly buttons: number;
  readonly relatedTarget: SafeEventTargetSnapshot | null;
  readonly pointerId: number;
  readonly width: number;
  readonly height: number;
  readonly pressure: number;
  readonly tangentialPressure: number;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly twist: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
}
interface SafeTouchSnapshot {
  readonly identifier: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotationAngle: number;
  readonly force: number;
  readonly target: SafeEventTargetSnapshot;
}
interface SafeTouchEvent extends SafeEventBase<"touch">, SafeModifierSnapshot {
  readonly touches: readonly SafeTouchSnapshot[];
  readonly targetTouches: readonly SafeTouchSnapshot[];
  readonly changedTouches: readonly SafeTouchSnapshot[];
}
interface SafeFocusEvent extends SafeEventBase<"focus"> {
  readonly relatedTarget: SafeEventTargetSnapshot | null;
}
interface SafeInputEvent extends SafeEventBase<"input"> {
  readonly data: string | null;
  readonly inputType: string;
  readonly isComposing: boolean;
}
type SafeEvent = SafeGenericEvent | SafeKeyboardEvent | SafeMouseEvent | SafePointerEvent | SafeTouchEvent | SafeFocusEvent | SafeInputEvent;
interface SafeStyle {
  /** Reads the canonical serialized value, or undefined when denied/invalid. */
  readonly get: (property: string) => string | undefined;
  /** Sets one policy-approved property. No coercion or URL-bearing CSS occurs. */
  readonly set: (property: string, value: string) => boolean;
  /** Removes one policy-approved property. */
  readonly remove: (property: string) => boolean;
}
type EventHandler<Event extends SafeEvent = SafeEvent> = (event: Event) => void;
type EventCleanup = () => void;
/** Host-supplied SES-compatible recursive object graph finalizer. */
type Hardener = <Value>(value: Value) => Value;
/** Explicit host acknowledgement for the complete non-credential form surface. */
interface SafeFormControlPolicy {
  readonly allowNonCredentialFormElements: true;
}
interface SafeDocumentOptions {
  /**
   * The host must call SES lockdown before importing this package and pass its
   * resulting global harden function here as an own data property.
   */
  readonly harden: Hardener;
  /** Missing policy means every URL-bearing sink is denied. */
  readonly urlPolicy?: SafeURLPolicy;
  /** Missing policy means every inline style property is denied. */
  readonly stylePolicy?: SafeStylePolicy;
  /**
   * Missing policy denies every public form-surface factory, including the
   * historically form-associated image element.
   */
  readonly formControlPolicy?: SafeFormControlPolicy;
}
interface SafeTextNode {
  readonly setText: (value: string) => void;
  readonly getText: () => string;
  /** Reversible DOM detach; the wrapper remains usable. */
  readonly detach: () => void;
  /** @deprecated Use detach(). */
  readonly remove: () => void;
  /** Irreversible and idempotent wrapper/resource revocation. */
  readonly dispose: () => void;
}
interface SafeElement {
  /** Reversible DOM detach; the wrapper and its subtree remain usable. */
  readonly detach: () => void;
  /** @deprecated Use detach(). */
  readonly remove: () => void;
  /** Irreversible and idempotent disposal of this wrapper and its owned subtree. */
  readonly dispose: () => void;
  readonly setClass: (value: string) => void;
  readonly getClass: () => string;
  readonly setId: (value: string) => void;
  readonly getId: () => string;
  readonly setTitle: (value: string) => void;
  readonly setRole: (value: AriaRole) => void;
  readonly setTabIndex: (value: number) => void;
  readonly setHidden: (value: boolean) => void;
  readonly setLang: (value: string) => void;
  /** Remove the local language declaration and return to HTML inheritance. */
  readonly clearLang: () => void;
  /** Local language declaration; undefined means inherited, empty means unknown. */
  readonly getLang: () => string | undefined;
  readonly setDir: (value: DirValue) => void;
  /** Remove the local direction declaration and return to HTML inheritance. */
  readonly clearDir: () => void;
  /** Local direction declaration; undefined means inherited. */
  readonly getDir: () => DirValue | undefined;
  readonly setTranslate: (value: boolean) => void;
  /** Remove the local translation instruction and return to HTML inheritance. */
  readonly clearTranslate: () => void;
  /** Local translation instruction; undefined means inherited. */
  readonly getTranslate: () => boolean | undefined;
  readonly setSpellcheck: (value: boolean) => void;
  readonly setData: (key: string, value: string) => void;
  readonly getData: (key: string) => string | undefined;
  readonly setAria: (key: string, value: string) => void;
  readonly getAria: (key: string) => string | undefined;
  readonly onClick: (handler: EventHandler<SafeMouseEvent>) => EventCleanup;
  readonly onDblClick: (handler: EventHandler<SafeMouseEvent>) => EventCleanup;
  readonly onMouseDown: (handler: EventHandler<SafeMouseEvent>) => EventCleanup;
  readonly onMouseUp: (handler: EventHandler<SafeMouseEvent>) => EventCleanup;
  readonly onMouseEnter: (handler: EventHandler<SafeMouseEvent>) => EventCleanup;
  readonly onMouseLeave: (handler: EventHandler<SafeMouseEvent>) => EventCleanup;
  readonly onMouseMove: (handler: EventHandler<SafeMouseEvent>) => EventCleanup;
  readonly onPointerDown: (handler: EventHandler<SafePointerEvent>) => EventCleanup;
  readonly onPointerUp: (handler: EventHandler<SafePointerEvent>) => EventCleanup;
  readonly onPointerMove: (handler: EventHandler<SafePointerEvent>) => EventCleanup;
  readonly onContextMenu: (handler: EventHandler<SafeMouseEvent>) => EventCleanup;
  readonly onKeyDown: (handler: EventHandler<SafeKeyboardEvent>) => EventCleanup;
  readonly onKeyUp: (handler: EventHandler<SafeKeyboardEvent>) => EventCleanup;
  readonly onFocus: (handler: EventHandler<SafeFocusEvent>) => EventCleanup;
  readonly onBlur: (handler: EventHandler<SafeFocusEvent>) => EventCleanup;
  readonly onTouchStart: (handler: EventHandler<SafeTouchEvent>) => EventCleanup;
  readonly onTouchEnd: (handler: EventHandler<SafeTouchEvent>) => EventCleanup;
  readonly onTouchMove: (handler: EventHandler<SafeTouchEvent>) => EventCleanup;
  readonly onScroll: (handler: EventHandler<SafeGenericEvent>) => EventCleanup;
  readonly style: SafeStyle;
}
interface SafeContainerElement extends SafeElement {
  readonly appendChild: (child: SafeElement | SafeTextNode) => void;
  readonly insertBefore: (newChild: SafeElement | SafeTextNode, reference: SafeElement | SafeTextNode) => void;
  readonly removeChild: (child: SafeElement | SafeTextNode) => void;
  readonly replaceChild: (newChild: SafeElement | SafeTextNode, oldChild: SafeElement | SafeTextNode) => void;
  /** Replace DOM descendants; their detached wrappers remain independently usable. */
  readonly setText: (value: string) => void;
  readonly getText: () => string;
}
interface SafeVoidElement extends SafeElement {}
interface SafeInputElement extends SafeVoidElement {
  readonly setType: (type: InputType) => void;
  readonly setValue: (value: string) => void;
  readonly getValue: () => string;
  readonly setPlaceholder: (value: string) => void;
  readonly setDisabled: (value: boolean) => void;
  readonly setReadOnly: (value: boolean) => void;
  /** @deprecated Use setReadOnly(). */
  readonly setReadonly: (value: boolean) => void;
  readonly setRequired: (value: boolean) => void;
  readonly setChecked: (value: boolean) => void;
  readonly getChecked: () => boolean;
  readonly setMin: (value: string) => void;
  readonly setMax: (value: string) => void;
  readonly setStep: (value: string) => void;
  readonly setMinLength: (value: number) => void;
  readonly setMaxLength: (value: number) => void;
  readonly setPattern: (value: string) => void;
  readonly setAutocomplete: (value: AutocompleteValue) => void;
  readonly setAutoFocus: (value: false) => void;
  /** @deprecated Use setAutoFocus(). */
  readonly setAutofocus: (value: false) => void;
  readonly setName: (value: string) => void;
  readonly setInputMode: (value: InputModeValue) => void;
  readonly setEnterKeyHint: (value: EnterKeyHintValue) => void;
  readonly onChange: (handler: EventHandler<SafeInputEvent>) => EventCleanup;
  readonly onInput: (handler: EventHandler<SafeInputEvent>) => EventCleanup;
}
interface SafeTextareaElement extends SafeContainerElement {
  readonly setValue: (value: string) => void;
  readonly getValue: () => string;
  readonly setPlaceholder: (value: string) => void;
  readonly setDisabled: (value: boolean) => void;
  readonly setReadOnly: (value: boolean) => void;
  /** @deprecated Use setReadOnly(). */
  readonly setReadonly: (value: boolean) => void;
  readonly setRequired: (value: boolean) => void;
  readonly setMinLength: (value: number) => void;
  readonly setMaxLength: (value: number) => void;
  readonly setRows: (value: number) => void;
  readonly setCols: (value: number) => void;
  readonly setWrap: (value: TextareaWrapValue) => void;
  readonly setName: (value: string) => void;
  readonly setAutocomplete: (value: AutocompleteValue) => void;
  readonly onChange: (handler: EventHandler<SafeInputEvent>) => EventCleanup;
  readonly onInput: (handler: EventHandler<SafeInputEvent>) => EventCleanup;
}
interface SafeSelectElement extends SafeContainerElement {
  readonly setValue: (value: string) => void;
  readonly getValue: () => string;
  readonly setDisabled: (value: boolean) => void;
  readonly setRequired: (value: boolean) => void;
  readonly setMultiple: (value: boolean) => void;
  readonly setName: (value: string) => void;
  readonly onChange: (handler: EventHandler<SafeInputEvent>) => EventCleanup;
}
interface SafeOptionElement extends SafeContainerElement {
  readonly setValue: (value: string) => void;
  readonly setSelected: (value: boolean) => void;
  readonly setDisabled: (value: boolean) => void;
  readonly setLabel: (value: string) => void;
}
interface SafeOptgroupElement extends SafeContainerElement {
  /** Required non-empty, localized label when no child legend supplies it. */
  readonly setLabel: (value: string) => void;
}
interface SafeButtonElement extends SafeContainerElement {
  readonly setType: (type: ButtonType) => void;
  readonly setDisabled: (value: boolean) => void;
  readonly setName: (value: string) => void;
  readonly setValue: (value: string) => void;
}
interface SafeLabelElement extends SafeContainerElement {
  readonly setFor: (value: string) => void;
  readonly getFor: () => string;
}
interface SafeFieldsetElement extends SafeContainerElement {
  readonly setDisabled: (value: boolean) => void;
}
interface SafeImageElement extends SafeVoidElement {
  readonly setSrc: (url: string) => SafeURLDecision;
  readonly setAlt: (value: string) => void;
  readonly setWidth: (value: number) => void;
  readonly setHeight: (value: number) => void;
  readonly setLoading: (value: ImageLoadingValue) => void;
}
interface SafeAnchorElement extends SafeContainerElement {
  readonly setHref: (url: string) => SafeURLDecision;
}
interface SafeVideoElement extends SafeContainerElement {
  readonly setSrc: (url: string) => SafeURLDecision;
  readonly setWidth: (value: number) => void;
  readonly setHeight: (value: number) => void;
  readonly setControls: (value: boolean) => void;
  readonly setAutoplay: (value: boolean) => void;
  readonly setLoop: (value: boolean) => void;
  readonly setMuted: (value: boolean) => void;
  readonly setPoster: (url: string) => SafeURLDecision;
}
interface SafeAudioElement extends SafeContainerElement {
  readonly setSrc: (url: string) => SafeURLDecision;
  readonly setControls: (value: boolean) => void;
  readonly setAutoplay: (value: boolean) => void;
  readonly setLoop: (value: boolean) => void;
  readonly setMuted: (value: boolean) => void;
}
interface SafeSourceElement extends SafeVoidElement {
  readonly setSrc: (url: string) => SafeURLDecision;
  readonly setType: (value: string) => void;
}
interface SafeTrackElement extends SafeVoidElement {
  readonly setKind: (value: TrackKind) => void;
  readonly setSrc: (url: string) => SafeURLDecision;
  readonly setSrcLang: (value: string) => void;
  readonly setLabel: (value: string) => void;
  readonly setDefault: (value: boolean) => void;
}
interface SafeCanvasElement extends SafeContainerElement {
  readonly setWidth: (value: number) => void;
  readonly setHeight: (value: number) => void;
}
interface SafeTableCellElement extends SafeContainerElement {
  readonly setColSpan: (value: number) => void;
  /** @deprecated Use setColSpan(). */
  readonly setColspan: (value: number) => void;
  readonly setRowSpan: (value: number) => void;
  /** @deprecated Use setRowSpan(). */
  readonly setRowspan: (value: number) => void;
  readonly setScope: (value: TableScopeValue) => void;
  readonly setHeaders: (value: string) => void;
  readonly getHeaders: () => string;
}
interface SafeDetailsElement extends SafeContainerElement {
  readonly setOpen: (value: boolean) => void;
}
interface SafeDialogElement extends SafeContainerElement {
  readonly setOpen: (value: boolean) => void;
}
interface SafeProgressElement extends SafeContainerElement {
  readonly setValue: (value: number) => void;
  readonly setMax: (value: number) => void;
}
interface SafeMeterElement extends SafeContainerElement {
  readonly setValue: (value: number) => void;
  readonly setMin: (value: number) => void;
  readonly setMax: (value: number) => void;
}
interface SafeListElement extends SafeContainerElement {
  /** Create a detached list item; append it explicitly. */
  readonly createItem: () => SafeContainerElement;
}
interface SafeDescriptionListElement extends SafeContainerElement {
  /** Create a detached term; append it explicitly. */
  readonly createTerm: () => SafeContainerElement;
  /** Create a detached description; append it explicitly. */
  readonly createDescription: () => SafeContainerElement;
}
interface SafeElementByKind {
  readonly input: SafeInputElement;
  readonly textarea: SafeTextareaElement;
  readonly select: SafeSelectElement;
  readonly option: SafeOptionElement;
  readonly optgroup: SafeOptgroupElement;
  readonly button: SafeButtonElement;
  readonly label: SafeLabelElement;
  readonly fieldset: SafeFieldsetElement;
  readonly image: SafeImageElement;
  readonly anchor: SafeAnchorElement;
  readonly video: SafeVideoElement;
  readonly audio: SafeAudioElement;
  readonly source: SafeSourceElement;
  readonly track: SafeTrackElement;
  readonly canvas: SafeCanvasElement;
  readonly th: SafeTableCellElement;
  readonly td: SafeTableCellElement;
  readonly details: SafeDetailsElement;
  readonly dialog: SafeDialogElement;
  readonly progress: SafeProgressElement;
  readonly meter: SafeMeterElement;
  readonly list: SafeListElement;
  readonly "description-list": SafeDescriptionListElement;
}
interface CreateList {
  (type: "unordered" | "ordered"): SafeListElement;
  (type: "description"): SafeDescriptionListElement;
  (type: ListType): SafeListElement | SafeDescriptionListElement;
}
interface GetElement {
  (id: string): SafeElement | null;
  <K extends SpecializedElementKind>(id: string, kind: K): SafeElementByKind[K] | null;
}
interface SafeDocument {
  /** Mount operations target the claimed ShadowRoot without exposing a root wrapper. */
  readonly appendChild: (child: SafeElement | SafeTextNode) => void;
  readonly insertBefore: (newChild: SafeElement | SafeTextNode, reference: SafeElement | SafeTextNode) => void;
  readonly removeChild: (child: SafeElement | SafeTextNode) => void;
  readonly replaceChild: (newChild: SafeElement | SafeTextNode, oldChild: SafeElement | SafeTextNode) => void;
  /** Irreversibly dispose every owned wrapper/resource. Idempotent. */
  readonly dispose: () => void;
  readonly createDiv: () => SafeContainerElement;
  readonly createSpan: () => SafeContainerElement;
  readonly createSection: () => SafeContainerElement;
  readonly createArticle: () => SafeContainerElement;
  readonly createNav: () => SafeContainerElement;
  readonly createHeader: () => SafeContainerElement;
  readonly createFooter: () => SafeContainerElement;
  readonly createMain: () => SafeContainerElement;
  readonly createAside: () => SafeContainerElement;
  readonly createFigure: () => SafeContainerElement;
  readonly createFigcaption: () => SafeContainerElement;
  readonly createParagraph: () => SafeContainerElement;
  /** @deprecated Use createParagraph(). */
  readonly createText: () => SafeContainerElement;
  readonly createHeading: (level: HeadingLevel) => SafeContainerElement;
  readonly createFormatting: (format: FormattingTag) => SafeContainerElement;
  /** Bidirectional isolation for caller text whose direction is not known in advance. */
  readonly createBdi: () => SafeContainerElement;
  readonly createBlockquote: () => SafeContainerElement;
  readonly createPre: () => SafeContainerElement;
  readonly createList: CreateList;
  readonly createListItem: () => SafeContainerElement;
  readonly createTerm: () => SafeContainerElement;
  readonly createDescription: () => SafeContainerElement;
  readonly createTable: () => SafeContainerElement;
  readonly createThead: () => SafeContainerElement;
  readonly createTbody: () => SafeContainerElement;
  readonly createTfoot: () => SafeContainerElement;
  readonly createTr: () => SafeContainerElement;
  readonly createTh: () => SafeTableCellElement;
  readonly createTd: () => SafeTableCellElement;
  readonly createCaption: () => SafeContainerElement;
  readonly createColgroup: () => SafeContainerElement;
  readonly createCol: () => SafeVoidElement;
  readonly createButton: () => SafeButtonElement;
  readonly createInput: () => SafeInputElement;
  readonly createSelect: () => SafeSelectElement;
  readonly createOption: () => SafeOptionElement;
  readonly createOptgroup: () => SafeOptgroupElement;
  readonly createTextarea: () => SafeTextareaElement;
  readonly createLabel: () => SafeLabelElement;
  readonly createFieldset: () => SafeFieldsetElement;
  readonly createLegend: () => SafeContainerElement;
  readonly createImage: () => SafeImageElement;
  readonly createVideo: () => SafeVideoElement;
  readonly createAudio: () => SafeAudioElement;
  readonly createSource: () => SafeSourceElement;
  readonly createTrack: () => SafeTrackElement;
  readonly createPicture: () => SafeContainerElement;
  readonly createCanvas: () => SafeCanvasElement;
  readonly createAnchor: () => SafeAnchorElement;
  readonly createDetails: () => SafeDetailsElement;
  readonly createSummary: () => SafeContainerElement;
  readonly createDialog: () => SafeDialogElement;
  readonly createHr: () => SafeVoidElement;
  readonly createBr: () => SafeVoidElement;
  readonly createWbr: () => SafeVoidElement;
  readonly createProgress: () => SafeProgressElement;
  readonly createMeter: () => SafeMeterElement;
  readonly createOutput: () => SafeContainerElement;
  readonly createTime: () => SafeContainerElement;
  readonly createData: () => SafeContainerElement;
  readonly createRuby: () => SafeContainerElement;
  readonly createRt: () => SafeContainerElement;
  readonly createRp: () => SafeContainerElement;
  readonly createTextNode: () => SafeTextNode;
  /** @deprecated Use createTextNode(). */
  readonly createRawText: () => SafeTextNode;
  readonly getElement: GetElement;
}
//#endregion
//#region src/primitives.d.ts
/** Runtime guards intentionally do not coerce boxed/stateful values. */
declare function requirePrimitiveString(value: unknown, operation: string): string;
declare function requirePrimitiveBoolean(value: unknown, operation: string): boolean;
declare function requireFiniteNumber(value: unknown, operation: string): number;
declare function requireInteger(value: unknown, operation: string): number;
//#endregion
//#region src/validation.d.ts
type CSSNetworkRisk = "invalid-input" | "malformed-comment" | "malformed-escape" | "import" | "url" | "image-set" | "image" | "src" | "indirect-value";
type CSSNetworkRiskDecision = Readonly<{
  risky: false;
}> | Readonly<{
  risky: true;
  risk: CSSNetworkRisk;
}>;
/**
 * Detect CSS constructs that can initiate a request. Unlike a raw regex, this
 * accounts for CSS comments, identifier escapes, hex-escape whitespace and
 * escaped newlines. Non-string and malformed input is rejected conservatively.
 */
declare function scanCSSNetworkRisk(value: unknown): CSSNetworkRiskDecision;
//#endregion
//#region src/index.d.ts
/**
 * Create a DOM capability scoped to one host-created ShadowRoot.
 *
 * The root host must already have effective computed paint containment and a
 * compatible display box. The host must maintain both containment and
 * controlled geometry for the lifetime of the returned capability.
 *
 * The returned object deliberately exposes mount operations rather than a
 * wrapper for the ShadowRoot or its host element.
 */
declare function createSafeDocument(root: ShadowRoot, options: SafeDocumentOptions): SafeDocument;
//#endregion
export { ARIA_IDREF_LIST_NAMES, ARIA_IDREF_NAMES, ARIA_ROLES, AUTOCOMPLETE_VALUES, type AriaIdRefListName, type AriaIdRefName, type AriaRole, type AutocompleteValue, BUTTON_TYPES, type ButtonType, type CSSNetworkRisk, type CSSNetworkRiskDecision, type CreateList, DIR_VALUES, type DirValue, ENTER_KEY_HINT_VALUES, type EnterKeyHintValue, type EventCleanup, type EventHandler, FORMATTING_TAGS, type FormattingTag, type GetElement, HEADING_LEVELS, type Hardener, type HeadingLevel, IMAGE_LOADING_VALUES, INPUT_MODE_VALUES, INPUT_TYPES, type ImageLoadingValue, type InputModeValue, type InputType, LIST_TYPES, type ListType, SAFE_STYLE_PROPERTIES, SPECIALIZED_ELEMENT_KINDS, type SafeAnchorElement, type SafeAudioElement, type SafeButtonElement, type SafeCanvasElement, type SafeContainerElement, type SafeDOMError, type SafeDOMErrorCode, type SafeDescriptionListElement, type SafeDetailsElement, type SafeDialogElement, type SafeDocument, type SafeDocumentOptions, type SafeElement, type SafeElementByKind, type SafeEvent, type SafeEventBase, type SafeEventKind, type SafeEventTargetSnapshot, type SafeFieldsetElement, type SafeFocusEvent, type SafeFormControlPolicy, type SafeGenericEvent, type SafeImageElement, type SafeInputElement, type SafeInputEvent, type SafeKeyboardEvent, type SafeLabelElement, type SafeListElement, type SafeMeterElement, type SafeModifierSnapshot, type SafeMouseEvent, type SafeOptgroupElement, type SafeOptionElement, type SafePointerEvent, type SafeProgressElement, type SafeSelectElement, type SafeSourceElement, type SafeStyle, type SafeStylePolicy, type SafeStyleProperty, type SafeTableCellElement, type SafeTextNode, type SafeTextareaElement, type SafeTouchEvent, type SafeTouchSnapshot, type SafeTrackElement, type SafeURLDecision, type SafeURLPolicy, type SafeVideoElement, type SafeVoidElement, type SpecializedElementKind, type StylePolicyEngine, TABLE_SCOPE_VALUES, TEXTAREA_WRAP_VALUES, TRACK_KINDS, type TableScopeValue, type TextareaWrapValue, type TrackKind, type URLConstructor, type URLPolicyEngine, type URLProtocol, type URLSink, type URLSinkPolicy, URL_SINKS, canonicalizeStyleProperty, createSafeDocument, createStylePolicy, createURLPolicy, isSafeDOMError, requireFiniteNumber, requireInteger, requirePrimitiveBoolean, requirePrimitiveString, scanCSSNetworkRisk };
//# sourceMappingURL=index.d.ts.map