import React, { useEffect, useMemo, useRef } from "react";
import type { PropsWithChildren } from "react";
import type { InstalledExtensions, HostConfig } from "../../host";
import { Host } from "../../host";
import { ExtensionContext } from "../extension-context";

interface ExtensionProviderProps extends HostConfig {
  extensions: InstalledExtensions;
}

function areExtensionsDifferent(
  set1: InstalledExtensions,
  set2: InstalledExtensions
) {
  const ids1 = Object.keys(set1).sort();
  const ids2 = Object.keys(set2).sort();
  return (
    ids1.length !== ids2.length || ids1.some((id, index) => id !== ids2[index])
  );
}

export function Extensible({
  rootName,
  runtimeContainer,
  extensions,
  children,
}: PropsWithChildren<ExtensionProviderProps>) {
  const installedRef = useRef<InstalledExtensions>();
  if (
    !installedRef.current ||
    areExtensionsDifferent(installedRef.current, extensions)
  ) {
    installedRef.current = extensions;
  }

  const host = useMemo(
    () =>
      new Host({
        rootName,
        runtimeContainer,
      }),
    [rootName, runtimeContainer]
  );

  useEffect(() => {
    host.load(installedRef.current!);
  }, [host, installedRef.current]);

  return (
    <ExtensionContext.Provider value={host}>
      {children}
    </ExtensionContext.Provider>
  );
}
export default Extensible;
