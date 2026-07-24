import { Channel, invoke } from "@tauri-apps/api/core";

import type {
  BrokerRequest,
  BrokerResponse,
  RawBrokerEvent,
  SessionToken,
} from "@/lib/capability-broker/contract.ts";
import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import { expectResponse } from "@/lib/capability-broker/desktop-codecs.ts";
import { createDecisionStore } from "@/lib/capability-broker/desktop-decision-store.ts";
import { createDesktopHostFacade } from "@/lib/capability-broker/desktop-host-facade.ts";
import {
  createPluginCapabilitySession,
} from "@/lib/capability-broker/desktop-plugin-session.ts";
import { createDesktopDirectHostFacade } from "@/lib/capability-broker/direct-desktop.ts";
import {
  snapshotPreparedPermissionRequest,
} from "@/lib/capability-broker/permission-preparation.ts";
import type {
  CapabilityBrokerRuntime,
  PluginCapabilitySession,
  PluginEventCapabilityFactory,
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";

type InvokeFunction = typeof invoke;
type ChannelFactory = (handler: (event: RawBrokerEvent) => void) => Channel<RawBrokerEvent>;
type EventFactoryProvider = () => PluginEventCapabilityFactory | undefined;

export type DesktopIpc = Readonly<{
  "invoke" : InvokeFunction;
  "channel": ChannelFactory;
}>;

const DEFAULT_DESKTOP_IPC: DesktopIpc = Object.freeze({
  invoke,
  "channel": handler => new Channel(handler),
});

export async function createDesktopCapabilityBroker(
  getEventFactory: EventFactoryProvider,
  ipc: DesktopIpc = DEFAULT_DESKTOP_IPC,
): Promise<CapabilityBrokerRuntime> {
  const bootstrap = await ipc.invoke<Readonly<{
    "session"   : SessionToken;
    "generation": number;
  }>>("bootstrap_capability_broker");
  const hostSession = bootstrap.session;
  const call = async (
    session: SessionToken,
    request: BrokerRequest,
    onEvent?: (event: RawBrokerEvent) => void,
  ): Promise<BrokerResponse> => {
    const events = onEvent === undefined ? undefined : ipc.channel(onEvent);

    return ipc.invoke<BrokerResponse>("capability_call", { session, request, events });
  };
  const hostCall: BrokerCall = (request, onEvent) => call(hostSession, request, onEvent);
  const host = createDesktopHostFacade(hostCall);

  await host.runtime.getSnapshot();

  return Object.freeze({
    host,
    "direct"                   : createDesktopDirectHostFacade(),
    "decisionStore"            : createDecisionStore(hostCall),
    "preparePermissionRequests": async (
      requests,
    ): Promise<ReadonlyArray<PreparedPermissionRequest>> => {
      const response = expectResponse(await hostCall({
        "kind"       : "prepare_permission_requests",
        "descriptors": requests,
      }), "permission_requests_prepared");

      return Object.freeze(
        response.descriptors.map(prepared => {
          return snapshotPreparedPermissionRequest(prepared);
        }),
      );
    },
    "openPluginSession": async (
      principal: PluginPrincipal,
    ): Promise<PluginCapabilitySession> => {
      const response = expectResponse(
        await hostCall({ "kind": "open_plugin", principal }),
        "plugin_opened",
      );
      const pluginSession = response.session;
      const pluginCall: BrokerCall = (request, onEvent) => {
        return call(pluginSession, request, onEvent);
      };

      return createPluginCapabilitySession(
        principal,
        pluginSession,
        pluginCall,
        hostCall,
        getEventFactory,
      );
    },
  } satisfies CapabilityBrokerRuntime);
}
