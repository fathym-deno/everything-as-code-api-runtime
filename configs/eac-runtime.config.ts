import { DefaultEaCConfig, defineEaCConfig, EaCRuntime } from '@fathym/eac/runtime';
import EaCAPIPlugin from '../src/plugins/EaCAPIPlugin.ts';
import { listenForCommits } from '../api/handlers/index.ts';
import { EverythingAsCode, loadJwtConfig } from '@fathym/eac';
import { EaCCommitRequest, EaCStatus, EaCStatusProcessingTypes } from '@fathym/eac/api';
import { enqueueAtomic } from '@fathym/eac/deno';
import { delay } from '$std/async/delay.ts';

export const config = defineEaCConfig({
  Plugins: [new EaCAPIPlugin(), ...(DefaultEaCConfig.Plugins || [])],
  Server: {
    port: 6130,
  },
});

export async function configure(rt: EaCRuntime): Promise<void> {
  await listenForCommits(rt);

  await initializePrimaryEaC(rt);
}

async function initializePrimaryEaC(rt: EaCRuntime): Promise<void> {
  console.log('Initializing primary EaC checks');

  const eacKv = await rt.IoC.Resolve(Deno.Kv, 'eac');

  const existingEaCs = await eacKv.list(
    { prefix: ['EaC'] },
    {
      limit: 1,
    },
  );

  let hasExistingEaCs = false;

  for await (const existingEaC of existingEaCs) {
    hasExistingEaCs = !!existingEaC.value;
    break;
  }

  if (!hasExistingEaCs) {
    console.log('Preparing core EaC record...');

    const commitKv = await rt.IoC.Resolve<Deno.Kv>(Deno.Kv, 'commit');

    const entLookup = crypto.randomUUID();

    const usernames = Deno.env.get('EAC_CORE_USERS')?.split(',') || [];

    const jwtConfig = loadJwtConfig();

    const createJwt = await jwtConfig.Create({ Username: usernames[0] });

    const createStatus: EaCStatus = {
      ID: crypto.randomUUID(),
      EnterpriseLookup: entLookup,
      Messages: { Queued: 'Creating new EaC container' },
      Processing: EaCStatusProcessingTypes.QUEUED,
      StartTime: new Date(Date.now()),
      Username: usernames[0],
    };

    const commitReq: EaCCommitRequest = {
      CommitID: createStatus.ID,
      EaC: {
        EnterpriseLookup: createStatus.EnterpriseLookup,
        Details: {
          Name: 'EaC Core',
          Description: 'The core EaC that sits as parent to all other EaCs',
        },
      },
      JWT: createJwt,
      ProcessingSeconds: 60,
      Username: usernames[0],
    };

    await enqueueAtomic(commitKv, commitReq, (op) => {
      return op
        .set(
          [
            'EaC',
            'Status',
            createStatus.EnterpriseLookup,
            'ID',
            createStatus.ID,
          ],
          createStatus,
        )
        .set(
          ['EaC', 'Status', createStatus.EnterpriseLookup, 'EaC'],
          createStatus,
        );
    });

    console.log('Waiting for core EaC record...');

    let eac: EverythingAsCode | null;

    do {
      await delay(100);

      eac = (
        await eacKv.get<EverythingAsCode>([
          'EaC',
          createStatus.EnterpriseLookup,
        ])
      ).value;
    } while (!eac);

    console.log(
      `Core EaC record has been created: ${createStatus.EnterpriseLookup}`,
    );

    const mainJwt = await jwtConfig.Create(
      {
        EnterpriseLookup: createStatus.EnterpriseLookup,
        Username: usernames[0],
      },
      1000 * 60 * 60 * 24 * 365 * 5,
    );

    console.log('The main JWT to use for connecting with EaC Core:');
    console.log(mainJwt);
  } else {
    console.log('There are existing EaC Records');
  }
}
