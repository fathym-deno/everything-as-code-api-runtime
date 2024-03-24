import { EaCMetadataBase, EverythingAsCode } from '@fathym/eac';
import jsonpath from 'npm:jsonpath';
import { loadConnections } from './loadConnections.ts';

export async function resolveDynamicValues(
  denoKv: Deno.Kv,
  values: Record<string, string>,
  eac: EverythingAsCode,
  jwt: string,
): Promise<Record<string, string>> {
  const valueLookups = Object.keys(values);

  const valueLookupsMap = valueLookups.reduce(
    (prev, key) => {
      if (values[key].startsWith('$connections:')) {
        prev.connections[key] = values[key];
      } else if (values[key].startsWith('$eac:')) {
        prev.eac[key] = values[key];
      } else {
        prev.passThrough[key] = values[key];
      }

      return prev;
    },
    {
      eac: {} as Record<string, string>,
      connections: {} as Record<string, string>,
      passThrough: {} as Record<string, string>,
    },
  );

  const valuesMap = {
    eac: resolveEaCValues(valueLookupsMap.eac, eac),
    connections: await resolveEaCConnectionValues(
      denoKv,
      valueLookupsMap.connections,
      eac,
      jwt,
    ),
    passThrough: valueLookupsMap.passThrough,
  };

  const result = valueLookups.reduce((prev, key) => {
    if (values[key].startsWith('$connections:')) {
      prev[key] = valuesMap.connections[key];
    } else if (values[key].startsWith('$eac:')) {
      prev[key] = valuesMap.eac[key];
    } else {
      prev[key] = valuesMap.passThrough[key];
    }

    return prev;
  }, {} as Record<string, string>);

  return result;
}

export async function resolveEaCConnectionValues(
  denoKv: Deno.Kv,
  values: Record<string, string>,
  eac: EverythingAsCode,
  jwt: string,
): Promise<Record<string, string>> {
  const valueKeys = Object.keys(values);

  const eacConnections: EverythingAsCode = {};

  if (valueKeys.length > 0) {
    const connKeys = ['Clouds', 'GitHubApps', 'IoT'];

    const connCalls = connKeys.map((key) => {
      return (async () => {
        const handler = eac.Handlers![key];

        const current = (eac[key] || {}) as Record<string, EaCMetadataBase>;

        const lookups = Object.keys(current);

        const def = lookups.reduce((prev, cur) => {
          prev![cur] = {};
          return prev;
        }, {} as Record<string, EaCMetadataBase>);

        const conns = await loadConnections(
          denoKv,
          eac,
          handler!,
          jwt,
          def,
          current,
          lookups,
        );

        eacConnections[key] = conns;
      })();
    });

    await Promise.all(connCalls);
  }

  const connectionValues = valueKeys.reduce((prev, key) => {
    if (values[key].startsWith('$connections:')) {
      const valuePath = values[key].replace('$connections:', '');

      prev[key] = jsonpath.value({ eac: eacConnections }, valuePath);
    } else {
      prev[key] = values[key];
    }

    return prev;
  }, {} as Record<string, string>);

  return connectionValues;
}

export function resolveEaCValues(
  values: Record<string, string>,
  eac: EverythingAsCode,
): Record<string, string> {
  const valueKeys = Object.keys(values);

  const eacValues = valueKeys.reduce((prev, key) => {
    if (values[key].startsWith('$eac:')) {
      const valuePath = values[key].replace('$eac:', '');

      prev[key] = jsonpath.value({ eac: eac }, valuePath);
    } else {
      prev[key] = values[key];
    }

    return prev;
  }, {} as Record<string, string>);

  return eacValues;
}
