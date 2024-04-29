// import {
//   EverythingAsCode,
//   initializeDenoKv,
//   loadJwtConfig,
//   UserEaCRecord,
// } from '../test.deps.ts';

// Deno.test('Init DB', async () => {
//   const denoKv = await initializeDenoKv('./denoKv/eac');

//   const username = 'michael.gearhardt@fathym.com';

//   const eac = {
//     EnterpriseLookup: crypto.randomUUID(),
//     Details: {
//       Name: 'Fathym Core EaC',
//       Description:
//         'The main Fathym EaC, serves as the parent of all other EaCs.',
//     },
//   } as EverythingAsCode;

//   const userEaCRecord: UserEaCRecord = {
//     EnterpriseLookup: eac.EnterpriseLookup!,
//     EnterpriseName: eac.Details!.Name!,
//     Owner: true,
//     ParentEnterpriseLookup: eac.ParentEnterpriseLookup!,
//     Username: username,
//   };

//   await denoKv
//     .atomic()
//     .set(['User', username, 'EaC', eac.EnterpriseLookup!], userEaCRecord)
//     .set(['EaC', 'Users', eac.EnterpriseLookup!, username], userEaCRecord)
//     .set(['EaC', 'Current', eac.EnterpriseLookup!], eac)
//     .commit();

//   console.log('Fathym Core Enterprise Lookup:');
//   console.log(eac.EnterpriseLookup);
//   console.log();

//   const jwt = await loadJwtConfig().Create({
//     EnterpriseLookup: eac.EnterpriseLookup!,
//     Username: username,
//   });

//   console.log('Fathym Core Enterprise JWT:');
//   console.log(jwt);
//   console.log();

//   denoKv.close();
// });
