import { DataEmitter, MessagePortEmitter } from "./emitters";
import type { WrappedMessage } from "./message-wrapper";
import { wrap } from "./message-wrapper";
import { ObjectSimulator } from "./object-simulator";
import { Materialized } from "./object-walker";
import { timeoutPromise } from "./promises/timed";
import { receiveCalls } from "./rpc";
import type { InitTicket } from "./tickets";
import { INIT_TICKET } from "./tickets";
import type { TunnelOptions } from "./tunnel";
import { createTunnel } from "./tunnel";

class Phantogram {
  // #region Properties

  config: TunnelOptions;
  events: EventTarget = new EventTarget();

  // #endregion Properties

  // #region Constructors

  constructor(options: TunnelOptions) {
    Phantogram.validateOptions(options);
    this.config = options;
  }

  // #endregion Constructors

  // #region Public Methods

  onConnected<Incoming>(handler: (received: Incoming) => void) {
    this.events.addEventListener("connected", (e: CustomEvent<Incoming>) =>
      handler(e.detail)
    );
  }

  async start(fromApi: unknown): Promise<void> {}

  // #endregion Public Methods

  // #region Private Static Methods

  private static validateOptions(options: TunnelOptions): Error | undefined {
    return undefined;
  }

  // #endregion Private Static Methods
}

/** @internal */
export async function phantogram<Expected>(
  {
    key = "phantogram",
    targetOrigin = "*",
    remote,
    timeout = 3000,
  }: TunnelOptions,
  apiToSend: unknown
): Promise<Materialized<Expected>> {
  const now = new Date().getTime();
  const tunnel = await createTunnel({ key, targetOrigin, remote, timeout });
  const elapsed = new Date().getTime() - now;
  // tunnel consumed some of the timeout
  const remainingTimeout = timeout - elapsed;

  const messagePortEmitter = new MessagePortEmitter(tunnel);

  const dataEmitter = new DataEmitter(messagePortEmitter);

  const simulator = ObjectSimulator.create(dataEmitter, FinalizationRegistry);

  const initMessage: WrappedMessage<InitTicket> = wrap(INIT_TICKET);
  const sendApi: Function = simulator.makeSender(initMessage);

  return timeoutPromise(
    "Initial API exchange",
    new Promise((resolve, reject) => {
      const unsubscribe = receiveCalls(
        resolve,
        INIT_TICKET,
        new WeakRef(simulator.subject)
      );
      const destroy = (e: Error | { reason: string }) => {
        unsubscribe();
        reject(e);
      };
      dataEmitter.onReceive("disconnected", destroy);
      sendApi(apiToSend).catch(destroy);
      messagePortEmitter.start();
    }),
    remainingTimeout,
    () => dataEmitter.send("disconnected", { reason: "timed out" })
  );
}
