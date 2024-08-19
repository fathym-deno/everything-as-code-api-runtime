import EaCAPIPlugin from '../src/plugins/EaCAPIPlugin.ts';
import { listenForCommits } from '../api/handlers/index.ts';
import { loadJwtConfig } from '@fathym/common/jwt';
import { EverythingAsCode } from '@fathym/eac';
import {
  EaCCommitRequest,
  EaCStatus,
  EaCStatusProcessingTypes,
  UserEaCRecord,
} from '@fathym/eac-api';
import { enqueueAtomic } from '@fathym/common/deno-kv';
import { DefaultEaCConfig, defineEaCConfig, EaCRuntime } from '@fathym/eac-runtime';
import { delay } from '@std/async/delay';

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
    { prefix: ['EaC', 'Current'] },
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

    const usernames = Deno.env.get('EAC_CORE_USERS')?.split('|') || [];

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

    await enqueueAtomic(
      commitKv,
      commitReq,
      (op) => {
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
      },
      eacKv,
    );

    console.log('Waiting for core EaC record...');

    let eac: EverythingAsCode | null;

    do {
      await delay(100);

      eac = (
        await eacKv.get<EverythingAsCode>([
          'EaC',
          'Current',
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

    const userRecords = usernames.map((username) => {
      return {
        EnterpriseLookup: eac!.EnterpriseLookup,
        EnterpriseName: eac!.Details!.Name,
        ParentEnterpriseLookup: eac!.ParentEnterpriseLookup,
        Username: username,
      } as UserEaCRecord;
    });

    let usersSetupOp = eacKv.atomic();

    userRecords.forEach((userEaCRecord) => {
      usersSetupOp = usersSetupOp
        .set(['User', userEaCRecord.Username, 'EaC', entLookup], userEaCRecord)
        .set(
          ['EaC', 'Users', entLookup, userEaCRecord.Username],
          userEaCRecord,
        );
    });

    await usersSetupOp.commit();
  } else {
    console.log('There are existing EaC Records');
  }
}
