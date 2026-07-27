import { expectTypeOf, test } from "vitest";

import type {
  HostFacade,
  HostHttpRequestInit,
} from "@/lib/capability-broker/types.ts";

function typecheckImmutableHostHttpRequestInit(init: HostHttpRequestInit): void {
  // @ts-expect-error Host request initialization is immutable.
  init.method = "POST";
}

function typecheckNarrowHostHttpContract(hostFetch: HostFacade["http"]["fetch"]): void {
  void hostFetch("https://example.test", { "method": "GET" });
  void hostFetch(new URL("https://example.test"), {
    "headers": { "x-test": "value" },
    "body"   : "payload",
  });

  // @ts-expect-error Host fetch does not accept Request input.
  void hostFetch(new Request("https://example.test"));
  // @ts-expect-error Host fetch owns redirect handling and does not expose this option.
  void hostFetch("https://example.test", { "redirect": "manual" });
  // @ts-expect-error Host fetch does not accept caller cancellation signals.
  void hostFetch("https://example.test", { "signal": (new AbortController).signal });
}

test("exposes a narrow immutable host HTTP contract", () => {
  expectTypeOf<Parameters<HostFacade["http"]["fetch"]>[0]>()
    .toEqualTypeOf<string | URL>();
  expectTypeOf<Parameters<HostFacade["http"]["fetch"]>[1]>()
    .toEqualTypeOf<HostHttpRequestInit | undefined>();
  expectTypeOf(typecheckNarrowHostHttpContract).toBeFunction();
  expectTypeOf(typecheckImmutableHostHttpRequestInit).toBeFunction();
});
