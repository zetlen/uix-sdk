import type { WrappedMessage } from "./message-wrapper";
import { wrap } from "./message-wrapper";
import { ObjectSimulator } from "./object-simulator";
import type { Asynced } from "./object-walker";
import { timeoutPromise } from "./promises/timed";
import { receiveCalls } from "./rpc";
import type { InitTicket } from "./tickets";
import { INIT_TICKET } from "./tickets";
import type { TunnelConfig } from "./tunnel";
import { Tunnel } from "./tunnel";

const INIT_MESSAGE: WrappedMessage<InitTicket> = wrap(INIT_TICKET);

/**
 * Representation of an object on the other side of an iframe/window divide
 * between JS runtimes.
 *
 * @remarks
 * At first, phantogram simply returned the proxy to the remote object and did
 * not expose any of the underlying event handling. However, there was no way
 * for a consumer to handle the case where the remote iframe reloaded, which
 * would invalidate all of the simulated objects.
 *
 * This new manager object exposes the {@link Tunnel} object so that consumers
 * can subscribe to the "api" event.
 * @alpha
 */
export interface Phantogram<ExpectedApi> {
  /**
   * The event emitter that transmits RPC events between remotes. Can be used to
   * listen to "api" events, which re-emit the initial remote API after an
   * unexpected reload. Can also be used to manually destroy the phantogram.
   * @internal
   */
  tunnel: Tunnel;
  /**
   * Accessor for the simulated object. Putting the object behind an accessor is
   * a way (we hope) to subtly discourage hanging on to a reference to the
   * object, which will invalidate without the holder of the reference knowing.
   * @internal
   */
  getRemoteApi(): Asynced<ExpectedApi>;
}

async function setupApiExchange<T>(
  tunnel: Tunnel,
  apiToSend: unknown
): Promise<Phantogram<T>> {
  let done = false;
  let remoteApi!: Asynced<T>;
  const phantogram: Phantogram<T> = {
    tunnel,
    getRemoteApi(): Asynced<T> {
      return remoteApi;
    },
  };
  return timeoutPromise(
    "Initial API exchange",
    new Promise((resolve, reject) => {
      const simulator = ObjectSimulator.create(tunnel, FinalizationRegistry);

      const sendApi: Function = simulator.makeSender(INIT_MESSAGE);
      const apiCallback = (api: Asynced<T>) => {
        remoteApi = api;
        if (!done) {
          done = true;
          resolve(phantogram);
        }
      };
      tunnel.on("api", apiCallback);

      const unsubscribe = receiveCalls(
        (api: Asynced<T>) => tunnel.emitLocal("api", api),
        INIT_TICKET,
        new WeakRef(simulator.subject)
      );
      const destroy = (e: Error) => {
        unsubscribe();
        if (!done) {
          done = true;
          reject(e);
        }
      };
      tunnel.on("destroyed", destroy);
      tunnel.on("connected", () => sendApi(apiToSend).catch(destroy));
    }),
    tunnel.config.timeout,
    () => tunnel.destroy()
  );
}

/**
 * Create a Phantogram in an iframe, simulating objects from the parent window.
 * @alpha
 */
export async function connectParentWindow<Expected>(
  tunnelOptions: Partial<TunnelConfig>,
  apiToSend: unknown
): Promise<Phantogram<Expected>> {
  const tunnel = Tunnel.toParent(window.parent, tunnelOptions);
  return setupApiExchange<Expected>(tunnel, apiToSend);
}

/**
 * Create a Phantogram simulating objects from the provided iframe runtime.
 * @alpha
 */
export async function connectIframe<Expected>(
  frame: HTMLIFrameElement,
  tunnelOptions: Partial<TunnelConfig>,
  apiToSend: unknown
): Promise<Phantogram<Expected>> {
  const tunnel = Tunnel.toIframe(frame, tunnelOptions);
  return setupApiExchange<Expected>(tunnel, apiToSend);
}
