/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import type {
  NamedEvent,
  TunnelOptions,
  Materialized,
  VirtualApi,
} from "@adobe/uix-core";
import { Emitter, phantogram } from "@adobe/uix-core";

interface GuestProxyWrapper {
  // #region Properties

  /**
   * Methods from guest
   */
  apis: Materialized<VirtualApi>;

  // #endregion Properties

  // #region Public Methods

  /**
   * Emit an event in the guest frame
   */
  emit(type: string, detail: unknown): Promise<void>;

  // #endregion Public Methods
}

/** @public */
type GuestFrameOptions = Partial<Omit<TunnelOptions, "remote" | "key">>;

const defaultOptions: GuestFrameOptions = {
  timeout: 10000,
};

export class GuestFrame extends Emitter<NamedEvent> {
  // #region Properties

  private iframe: HTMLIFrameElement;
  private logger?: Console;
  private proxy: GuestProxyWrapper;
  private timeout: number;
  private url: URL;

  /**
   * If any errors occurred during the loading of guests, this property will
   * contain the error that was raised.
   * @public
   */
  error?: Error;

  // #endregion Properties

  // #region Constructors

  constructor(config: {
    iframe: HTMLIFrameElement;
    owner: string;
    id: string;
    url: string;
    logger?: Console;
    options: GuestFrameOptions;
  }) {
    super(config.id);
    const { timeout } = { ...defaultOptions, ...(config.options || {}) };
    this.timeout = timeout;
    this.id = config.id;
    this.url = this.createFrameUrl(this.id, config.url);
    this.iframe = config.iframe;
  }

  // #endregion Constructors

  // #region Public Methods

  public connect() {
    this.setOnFrame({
      "data-uix-guest-id": this.id,
      name: this.id,
      src: this.url.href,
    });
    this.attachFrame();
  }

  // #endregion Public Methods

  // #region Private Methods

  private attachFrame(iframe: HTMLIFrameElement, key: string) {
    if (!iframe.isConnected) {
      this.runtimeContainer.appendChild(this.guestServerFrame);
      if (this.logger) {
        this.logger.info(
          `Guest ${this.id} attached iframe of ${this.url.href}`,
          this
        );
      }
    }
    iframe.addEventListener("load", () => {});
  }

  private connectTunnel() {
    this.tunnel = phantogram<GuestProxyWrapper>({
      key: iframe.dataset.uixGuestKey,
      remote: iframe,
      targetOrigin: "*",
      timeout: this.timeout,
    });
  }

  private createFrameUrl(key: string, url: string = "/"): URL {
    const frameUrl = new URL(url, this.url);
    return frameUrl;
  }

  private setOnFrame(attributes: Record<string, string>) {
    for (const [attr, value] of Object.entries(attributes)) {
      this.iframe.setAttribute(attr, value);
    }
  }

  /**
   * Disconnect from the extension.
   */
  private async unload(): Promise<void> {
    if (this.iframe.isConnected) {
      this.iframe.parentElement.removeChild(this.iframe);
      this.iframe = undefined;
    }
    this.emit("unload", { guestPort: this });
  }

  // #endregion Private Methods
}
