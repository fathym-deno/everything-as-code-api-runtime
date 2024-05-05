// deno-lint-ignore-file no-explicit-any
import { decode as djwtDecode } from '@djwt';
import { merge } from '@fathym/common';
import {
  EaCCloudAsCode,
  EaCCloudAzureDetails,
  EaCCloudResourceAsCode,
  EaCCloudResourceFormatDetails,
  EaCCloudResourceGroupAsCode,
  EaCCloudResourceGroupDetails,
  EverythingAsCodeClouds,
} from '@fathym/eac';
import {
  loadAzureCloudCredentials,
  loadMainAzureCredentials,
  loadResoureTypeApiVersions,
} from '@fathym/eac/azure';
import { AuthorizationManagementClient } from 'npm:@azure/arm-authorization';
import {
  Deployment,
  DeploymentExtended,
  GenericResourceExpanded,
  ResourceManagementClient,
} from 'npm:@azure/arm-resources';
import { SubscriptionClient } from 'npm:@azure/arm-subscriptions';
import { AccessToken } from 'npm:@azure/identity';
import {
  AuthenticationProvider,
  AuthenticationProviderOptions,
  Client as GraphClient,
} from 'npm:@microsoft/microsoft-graph-client';
import {
  Application,
  PasswordCredential,
  ServicePrincipal,
} from 'npm:@microsoft/microsoft-graph-types';
import { TokenCredential } from 'npm:@azure/identity';
import Handlebars from 'npm:handlebars/dist/handlebars.min.js';
import { EaCCloudDeployment } from '../reqres/EaCCloudDeployment.ts';
import { EaCHandlerCheckRequest } from '../reqres/EaCHandlerCheckRequest.ts';
import { delay } from '$std/async/delay.ts';

class TokenProvider implements AuthenticationProvider {
  constructor(
    protected credential: TokenCredential,
    protected authenticationProviderOptions: AuthenticationProviderOptions,
  ) {}

  public async getAccessToken(): Promise<string> {
    const creds = loadMainAzureCredentials();

    const accessToken = await creds.getToken(
      this.authenticationProviderOptions!.scopes!,
    );

    return accessToken.token;
  }
}

export async function getCurrentAzureUser(accessToken: string) {
  // console.log(`Finalizing EaC commit ${commitId} Cloud details`);

  // const creds = loadAzureCloudCredentials(cloud);
  // const creds = loadMainAzureCredentials();

  const graphClient = GraphClient.initWithMiddleware({
    authProvider: new TokenProvider(
      {
        getToken: () => {
          return Promise.resolve({
            token: accessToken,
          } as AccessToken);
        },
      } as TokenCredential,
      {
        scopes: [`https://graph.microsoft.com/.default`], //"Application.Read.All"],
      },
    ),
  });

  const me = await graphClient
    .api('/me')
    // .select(["id"])
    .get();

  return me;
}

export async function finalizeCloudDetails(
  entLookup: string,
  cloudLookup: string,
  commitId: string,
  cloud: EaCCloudAsCode,
): Promise<void> {
  if (cloud.Details) {
    console.log(`Finalizing EaC commit ${commitId} Cloud details`);

    const details = cloud.Details as EaCCloudAzureDetails;

    if (cloud.Token) {
      const creds = await loadAzureCloudCredentials(cloud);

      const subClient = new SubscriptionClient(creds);

      const graphClient = GraphClient.initWithMiddleware({
        authProvider: new TokenProvider(
          {
            getToken: () => {
              return cloud.Token;
            },
          } as TokenCredential,
          {
            scopes: [`https://graph.microsoft.com/.default`], //"Application.Read.All"],
          },
        ),
      });

      const [_, payload] = await djwtDecode(cloud.Token as string);

      if (!details.TenantID) {
        details.TenantID ??= (payload as any).tid;
      }

      if (!details.SubscriptionID) {
        // && !details.TenantID) {
        const createResp = await subClient.alias.beginCreateAndWait(
          crypto.randomUUID(),
          {
            properties: {
              displayName: details.Name as string,
              workload: details.IsDev ? 'DevTest' : 'Production',
              billingScope: details.BillingScope as string,
              additionalProperties: {
                subscriptionTenantId: details.TenantID as string,
                subscriptionOwnerId: (payload as any).oid,
              },
            },
          },
        );

        details.SubscriptionID = createResp.properties?.subscriptionId!;

        delete details.AgreementType;
        delete details.BillingScope;
        delete details.IsDev;
      }

      if (details.SubscriptionID && !details.Name) {
        const sub = await subClient.subscriptions.get(details.SubscriptionID);

        details.Name = sub.displayName;

        details.Description ??= sub.displayName;
      }

      if (
        details.SubscriptionID &&
        details.TenantID &&
        !details.ApplicationID
      ) {
        const appName = `eac|${details.SubscriptionID}|${entLookup}|${cloudLookup}`;

        const appRes: { value: Application[] } = await graphClient
          .api('/applications')
          .filter(`displayName eq '${appName}'`)
          .get();

        let app = appRes.value[0];

        if (!app) {
          app = {
            displayName: appName,
            description: details.Description,
          };
        }

        // TODO(mcgear): Ensure only a single application is create per some context, retreive existing and update it if necessary... Or...
        app = await graphClient.api('/applications').post(app);

        details.ApplicationID = app.appId!;
      }

      if (
        details.SubscriptionID &&
        details.TenantID &&
        details.ApplicationID &&
        !details.AuthKey
      ) {
        const appName = `eac|${details.SubscriptionID}|${entLookup}|${cloudLookup}`;

        const spRes: { value: ServicePrincipal[] } = await graphClient
          .api('/servicePrincipals')
          .filter(`appId eq '${details.ApplicationID}'`)
          .filter(`displayName eq '${appName}'`)
          .get();

        let svcPrincipal = spRes.value[0];

        if (!svcPrincipal) {
          svcPrincipal = {
            appId: details.ApplicationID,
            displayName: appName,
            description: details.Description,
          };
        }

        // TODO(mcgear): Ensure only a single svc principal is create per some context, retreive existing and update it if necessary... Or...
        svcPrincipal = await graphClient
          .api('/servicePrincipals')
          .post(svcPrincipal);

        details.ID = svcPrincipal.id!;

        const spPassword: PasswordCredential = await graphClient
          .api(`/servicePrincipals/${details.ID}/addPassword`)
          .post({
            displayName: `${details.Name} Password`,
          } as PasswordCredential);

        details.AuthKey = spPassword.secretText!;

        const client = new AuthorizationManagementClient(
          creds,
          details.SubscriptionID,
        );

        const scope = `/subscriptions/${details.SubscriptionID}`;

        await client.roleAssignments.create(scope, details.ID, {
          // Owner - https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
          roleDefinitionId:
            `${scope}/providers/Microsoft.Authorization/roleDefinitions/8e3af657-a8ff-443c-a75c-2fe8c4bcb635`,
          principalId: details.ID,
          principalType: 'ServicePrincipal',
        });

        await delay(5000);

        // TODO(mcgear): Add role assignment (if necessary)
        // await graphClient
        //   .api(`/servicePrincipals/${details.ID}/appRoleAssignments`)
        //   .post({
        //     // Owner - https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
        //     appRoleId: '8e3af657-a8ff-443c-a75c-2fe8c4bcb635',
        //     principalId: details.ID,
        //     resourceId: details.ApplicationID,
        //   } as PasswordCredential);
      }

      if (!details.ID && details.ApplicationID) {
        const svcPrinc = await graphClient
          .api('/servicePrincipals')
          .filter(`appId eq '${details.ApplicationID}'`)
          .select(['id'])
          .get();

        details.ID = svcPrinc.value[0].id;
      }
    }
  }

  cloud.Token = '';
}

export async function buildCloudDeployments(
  commitId: string,
  eac: EverythingAsCodeClouds,
  cloudLookup: string,
  cloud: EaCCloudAsCode,
): Promise<EaCCloudDeployment[]> {
  console.log(`Building EaC commit ${commitId} Cloud deloyments`);

  const resGroupLookups = Object.keys(cloud.ResourceGroups || {});

  const deployments: EaCCloudDeployment[] = [];

  for (const resGroupLookup of resGroupLookups) {
    const resGroup = cloud.ResourceGroups![resGroupLookup];

    const deployment = await buildCloudDeployment(
      commitId,
      eac,
      cloudLookup,
      resGroupLookup,
      resGroup,
    );

    if (deployment) {
      deployments.push(deployment);
    }
  }

  return deployments;
}

export async function buildCloudDeployment(
  commitId: string,
  eac: EverythingAsCodeClouds,
  cloudLookup: string,
  resGroupLookup: string,
  resGroup: EaCCloudResourceGroupAsCode,
): Promise<EaCCloudDeployment | undefined> {
  if (Object.keys(resGroup.Resources || {}).length > 0) {
    console.log(
      `Building EaC commit ${commitId} Cloud deployment for ${resGroupLookup}`,
    );

    const resGroupTemplateResources: Record<string, unknown>[] = [];

    const useResGroupDetails = resGroup.Details ||
      eac.Clouds![cloudLookup].ResourceGroups![resGroupLookup].Details;

    const armResources = await buildArmResourcesForResourceGroupDeployment(
      useResGroupDetails!,
      cloudLookup,
      resGroupLookup,
      resGroup,
    );

    resGroupTemplateResources.push(...armResources);

    const deploymentName = `resource-group-${resGroupLookup}-${Date.now()}`;

    const deployment: Deployment = {
      location: useResGroupDetails!.Location,
      properties: {
        mode: 'Incremental',
        expressionEvaluationOptions: {
          scope: 'outer',
        },
        template: {
          $schema:
            'https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#',
          contentVersion: '1.0.0.0',
          resources: resGroupTemplateResources,
        },
      },
      tags: {
        Cloud: cloudLookup,
      },
    };

    return {
      CloudLookup: cloudLookup,
      Deployment: deployment,
      Name: deploymentName,
      ResourceGroupLookup: resGroupLookup,
    };
  }

  return undefined;
}

export async function buildArmResourcesForResourceGroupDeployment(
  useResGroupDetails: EaCCloudResourceGroupDetails,
  cloudLookup: string,
  resGroupLookup: string,
  resGroup: EaCCloudResourceGroupAsCode,
): Promise<Record<string, unknown>[]> {
  const armResources: Record<string, unknown>[] = [];

  armResources.push({
    type: 'Microsoft.Resources/resourceGroups',
    apiVersion: '2018-05-01',
    name: resGroupLookup,
    location: useResGroupDetails.Location,
    tags: {
      Cloud: cloudLookup,
    },
  });

  const resourceArmResources = await buildArmResourcesForResources(
    cloudLookup,
    resGroupLookup,
    resGroup.Resources || {},
    [`[resourceId('Microsoft.Resources/resourceGroups', '${resGroupLookup}')]`],
  );

  armResources.push(...resourceArmResources);

  return armResources;
}

export async function buildArmResourcesForResources(
  cloudLookup: string,
  resGroupLookup: string,
  resources: Record<string, EaCCloudResourceAsCode>,
  dependsOn: string[],
): Promise<Record<string, unknown>[]> {
  const resLookups = Object.keys(resources);

  const armResources: Record<string, unknown>[] = [];

  for (const resLookup of resLookups) {
    const resource = resources[resLookup];

    const resArmResource = await buildResourceTemplateResource(
      cloudLookup,
      resGroupLookup,
      resLookup,
      resource,
      dependsOn,
    );

    armResources.push(resArmResource);
  }

  return armResources;
}

export async function buildResourceTemplateResource(
  cloudLookup: string,
  resGroupLookup: string,
  resLookup: string,
  resource: EaCCloudResourceAsCode,
  dependsOn: string[],
): Promise<Record<string, unknown>> {
  const details = resource.Details as EaCCloudResourceFormatDetails;

  const assets = await loadCloudResourceDetailAssets(details);

  const deploymentName = `resource-${resLookup}-${Date.now()}`;

  const armResource = {
    type: 'Microsoft.Resources/deployments',
    apiVersion: '2019-10-01',
    dependsOn: dependsOn,
    resourceGroup: resGroupLookup,
    name: deploymentName,
    properties: {
      mode: 'Incremental',
      expressionEvaluationOptions: {
        scope: 'inner',
      },
      parameters: formatParameters(details.Data || {}, assets.Parameters),
      template: {
        ...assets.Content,
      },
    },
    tags: {
      Cloud: cloudLookup,
    },
  };

  const peerResources = armResource.properties.template.resources as Record<
    string,
    unknown
  >[];

  if (resource.Resources) {
    const subResArmResources = await buildArmResourcesForResources(
      cloudLookup,
      resGroupLookup,
      resource.Resources || {},
      peerResources.map((pr) => {
        let name = pr.name as string;

        if (name.startsWith('[')) {
          name = name.substring(1, name.length - 1);
        } else {
          name = `'${name}'`;
        }

        return `[resourceId('${pr.type}', ${name})]`;
      }),
      // [
      //   // `[resourceId('Microsoft.Resources/resourceGroups', '${resGroupLookup}')]`,
      //   // `[resourceId('Microsoft.Resources/deployments', '${deploymentName}')]`,
      // ],
    );

    peerResources.push(...subResArmResources);
  }

  return armResource;
}

export async function loadCloudResourceDetailAssets(
  details: EaCCloudResourceFormatDetails,
): Promise<{
  Content: Record<string, unknown>;
  Parameters: Record<string, unknown>;
}> {
  const assetPaths = [
    { Lookup: 'Content', Path: details.Template.Content },
    { Lookup: 'Parameters', Path: details.Template.Parameters },
  ];

  const assetCalls = assetPaths.map(async (asset) => {
    const result = await fetch(asset.Path);

    return {
      Lookup: asset.Lookup,
      Value: (await result.json()) as Record<string, unknown>,
    };
  });

  const assets = (await Promise.all(assetCalls)).reduce((prev, cur) => {
    return {
      ...prev,
      [cur.Lookup]: cur.Lookup == 'Parameters' ? cur.Value.parameters : cur.Value,
    };
  }, {}) as {
    Content: Record<string, unknown>;
    Parameters: Record<string, unknown>;
  };

  return assets;
}

export async function loadCloudResourceGroupsConnections(
  cloud: EaCCloudAsCode,
  resGroupsDef: Record<string, EaCCloudResourceGroupAsCode>,
  resGroups: Record<string, EaCCloudResourceGroupAsCode>,
  resGroupLookups: string[],
): Promise<Record<string, EaCCloudResourceGroupAsCode>> {
  const creds = await loadAzureCloudCredentials(cloud);

  const details = cloud.Details as EaCCloudAzureDetails;

  const resClient = new ResourceManagementClient(creds, details.SubscriptionID);

  const mappedCalls = resGroupLookups!.map(async (resGroupLookup) => {
    const resGroupDef = resGroupsDef && resGroupsDef[resGroupLookup]
      ? resGroupsDef[resGroupLookup]
      : {};

    let resLookups = Object.keys(resGroupDef.Resources || {});

    const resGroup = resGroups![resGroupLookup];

    if (resLookups.length === 0) {
      resLookups = Object.keys(resGroup.Resources || {});
    }

    const resGroupAzureResourcesResult = await resClient.resources.listByResourceGroup(
      resGroupLookup,
    );

    const resGroupAzureResources: GenericResourceExpanded[] = [];

    for await (const resGroupAzureResource of resGroupAzureResourcesResult) {
      resGroupAzureResources.push(resGroupAzureResource);
    }

    const apiVersions = await loadResoureTypeApiVersions(
      resClient,
      resGroupAzureResources.map((rgar) => rgar.type!),
    );

    return {
      ResourceGroupLookup: resGroupLookup,
      ResourceGroup: {
        Resources: await loadCloudResourcesConnections(
          creds,
          resGroupAzureResources,
          apiVersions,
          resGroupDef.Resources || {},
          resGroup.Resources || {},
          resLookups,
        ),
      },
    };
  }, {});

  const mapped = await Promise.all(mappedCalls);

  return mapped.reduce((rgs, rg) => {
    rgs[rg.ResourceGroupLookup] = rg.ResourceGroup;

    return rgs;
  }, {} as Record<string, EaCCloudResourceGroupAsCode>);
}

export async function loadCloudResourcesConnections(
  creds: TokenCredential,
  azureResources: GenericResourceExpanded[],
  apiVersions: Record<string, string>,
  resourcesDef: Record<string, EaCCloudResourceAsCode>,
  resources: Record<string, EaCCloudResourceAsCode>,
  resLookups: string[],
): Promise<Record<string, EaCCloudResourceAsCode>> {
  const mappedCalls = resLookups!.map(async (resLookup) => {
    const resAzureResources = azureResources.filter(
      (ar) => ar.tags && ar.tags.ResourceLookup === resLookup,
    );

    const resKeys: Record<string, unknown> = {};

    const resLocations: Record<string, unknown> = {};

    const resPubProfiles: Record<string, unknown> = {};

    for (const ar of resAzureResources) {
      try {
        const apiVersion = apiVersions[ar.type!] || '2023-01-01';

        const resLookupKey = `${ar.type}/${ar.name}`;

        resKeys[resLookupKey] = await loadResourceKeys(
          creds,
          apiVersion,
          ar.id!,
          ar.type!,
        );

        resLocations[resLookupKey] = ar.location!;

        if (ar.type === 'Microsoft.Web/sites') {
          resPubProfiles[resLookupKey] = await loadResourcePublishProfiles(
            creds,
            apiVersion,
            ar.id!,
          );
        }
      } catch (err) {
        console.error(err);

        err.toString();
      }
    }

    const resDef = resourcesDef && resourcesDef[resLookup] ? resourcesDef[resLookup] : {};

    let resResLookups = Object.keys(resDef?.Resources || {});

    const res = resources![resLookup];

    if (resResLookups.length === 0) {
      resResLookups = Object.keys(res.Resources || {});
    }

    return {
      ResourceLookup: resLookup,
      Resource: {
        Keys: resKeys,
        Locations: resLocations,
        Profiles: resPubProfiles,
        Resources: await loadCloudResourcesConnections(
          creds,
          azureResources,
          apiVersions,
          resDef?.Resources || {},
          res.Resources || {},
          resResLookups,
        ),
      },
    };
  }, {});

  const mapped = await Promise.all(mappedCalls);

  return mapped.reduce((rss, rs) => {
    rss[rs.ResourceLookup] = rs.Resource;

    return rss;
  }, {} as Record<string, EaCCloudResourceAsCode>);
}

export async function loadResourcePublishProfiles(
  creds: TokenCredential,
  apiVersion: string,
  resId: string,
) {
  const token = await creds.getToken([
    'https://management.azure.com//.default',
  ]);

  // const slotsResponse = await fetch(
  //   `https://management.azure.com${resId}/slots?api-version=${apiVersion}`,
  //   {
  //     method: "GET",
  //     headers: {
  //       Authorization: `Bearer ${token.token}`,
  //     },
  //   },
  // );

  // let slots = await slotsResponse.json();

  const pubProfilesResponse = await fetch(
    `https://management.azure.com${resId}/publishxml?api-version=${apiVersion}`,
    {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        Authorization: `Bearer ${token!.token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const pubXml = await pubProfilesResponse.text();

  const pubProfiles: Record<string, unknown> = {};

  pubProfiles['_'] = pubXml;

  // if (!keys.error) {
  //   if (Array.isArray(keys)) {
  //     keys.forEach((key) => (localKeys[key.keyName] = key.value));
  //   } else if (keys.value && Array.isArray(keys.value)) {
  //     (keys.value as Record<string, any>[]).forEach(
  //       (key) => (localKeys[key.keyName] = key.value || key.primaryKey),
  //     );
  //   } else {
  //     localKeys = keys;
  //   }
  // }

  return pubProfiles;
}

export async function loadResourceKeys(
  creds: TokenCredential,
  apiVersion: string,
  resId: string,
  resType: string,
) {
  const token = await creds.getToken([
    'https://management.azure.com//.default',
  ]);

  const keyPaths = [
    `https://management.azure.com${resId}/listKeys?api-version=${apiVersion}`,
    `https://management.azure.com${resId}/listConnectionStrings?api-version=${apiVersion}`,
    `https://management.azure.com${resId}//host/default/listKeys?api-version=${apiVersion}`,
    `https://management.azure.com${resId}/listQueryKeys?api-version=${apiVersion}`,
  ];

  let localKeys: Record<string, unknown> = {};

  const keyPathMaps: Record<string, number> = {
    'Microsoft.Devices/IotHubs': 0,
    'Microsoft.Storage/storageAccounts': 0,
    'Microsoft.OperationalInsights/workspaces': 0,
    'Microsoft.Web/sites': 2,
  };

  const keyPathIndex = keyPathMaps[resType];

  if (keyPathIndex >= 0) {
    const keyPath = keyPaths[keyPathIndex];

    const response = await fetch(keyPath, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        Authorization: `Bearer ${token!.token}`,
      },
    });

    try {
      const text = await response.text();

      // console.log(text);

      const keys = JSON.parse(text);

      if (!keys.error) {
        if (Array.isArray(keys)) {
          keys.forEach((key) => (localKeys[key.keyName] = key.value));
        } else if (keys.value && Array.isArray(keys.value)) {
          (keys.value as Record<string, any>[]).forEach(
            (key) => (localKeys[key.keyName] = key.value || key.primaryKey),
          );
        } else {
          localKeys = keys;
        }
      }
    } catch (e) {
      e.toString();
    }
  }

  return localKeys;
}

export async function beginEaCDeployments(
  commitId: string,
  cloud: EaCCloudAsCode,
  deployments: EaCCloudDeployment[],
): Promise<EaCHandlerCheckRequest[]> {
  console.log(`Beginning EaC commit ${commitId} Cloud deloyments`);

  const details = cloud.Details as EaCCloudAzureDetails;

  const creds = await loadAzureCloudCredentials(cloud);

  const resClient = new ResourceManagementClient(creds, details.SubscriptionID);

  const beginDeploymentCalls = deployments.map(async (deployment) => {
    const _beginDeploy = await resClient.deployments.beginCreateOrUpdateAtSubscriptionScope(
      // deployment.ResourceGroupLookup,
      deployment.Name,
      deployment.Deployment,
    );

    return {
      CommitID: commitId,
      CorelationID: crypto.randomUUID(),
      ...deployment,
    } as EaCHandlerCheckRequest;
  });

  const checks = await Promise.all(beginDeploymentCalls);

  return checks;
}

export async function loadDeploymentDetails(
  commitId: string,
  cloud: EaCCloudAsCode,
  deploymentName: string,
  resGroupLookup?: string,
  resGroupLookupPassthrough?: string,
): Promise<{
  Deployment: DeploymentExtended;
  Messages: Record<string, unknown>;
}> {
  console.log(
    `Processing EaC commit ${commitId} Cloud checks for deployment ${deploymentName}`,
  );

  const details = cloud.Details as EaCCloudAzureDetails;

  const creds = await loadAzureCloudCredentials(cloud);

  const resClient = new ResourceManagementClient(creds, details.SubscriptionID);

  const getDeployment = resGroupLookup
    ? resClient.deployments.get(resGroupLookup, deploymentName)
    : resClient.deployments.getAtSubscriptionScope(deploymentName);

  const deployment = await getDeployment;

  const list = resGroupLookup
    ? resClient.deploymentOperations.list(resGroupLookup, deploymentName)
    : resClient.deploymentOperations.listAtSubscriptionScope(deploymentName);

  const ops = await list;

  const messages: Record<string, unknown> = {
    [deploymentName]: {
      LastActivity: deployment.properties!.timestamp,
      State: deployment.properties!.provisioningState,
    },
  };

  for await (const operation of ops) {
    const nextResource = operation.properties!.targetResource?.resourceName!;

    if (
      operation.properties?.targetResource?.resourceType ===
        'Microsoft.Resources/deployments'
    ) {
      const subDeployDetails = await loadDeploymentDetails(
        commitId,
        cloud,
        nextResource,
        resGroupLookupPassthrough,
        resGroupLookupPassthrough,
      );

      messages[deploymentName] = merge(
        messages[deploymentName] as object,
        subDeployDetails.Messages,
      );
    } else if (nextResource) {
      messages[deploymentName] = merge(messages[deploymentName] as object, {
        [nextResource]: {
          // Duration: operation.properties!.duration,
          LastActivity: operation.properties!.timestamp,
          Message: operation.properties!.statusMessage,
          Operation: operation.properties!.provisioningOperation,
          State: operation.properties!.provisioningState,
          Status: operation.properties!.statusCode,
          Type: operation.properties!.targetResource?.resourceType,
        },
      });
    }
  }

  return {
    Deployment: deployment,
    Messages: messages,
  };
}

export function formatParameters(
  parameters: Record<string, unknown>,
  paramsTemplate: Record<string, unknown>,
): Record<string, unknown> {
  const params = JSON.stringify(paramsTemplate);

  const result = Handlebars.compile(params)(parameters);

  return JSON.parse(result) as Record<string, unknown>;
}
