# Evaluation interfaces

Campaign fixed ID `tikdam-v1-eval-2026-11-01`. Meta 3000000microUSD/1000 HTTP attempts; Modal500000; Baseten500000; total4000000. Operating stops2700000/450000/450000. No reset. One admitted operation at a time across all providers. Production/public AI stays disabled. Only lead sends live requests, no worker has authority to call provider networks. Never read secret values into output.

## Ledger worker

Own `server/evaluation/ledger.mjs`, `server/evaluation/schema.sql`, `tests/evaluation/ledger.test.mjs`, and `server/evaluation/runtime.mjs`. Export:

`createEvaluationLedger(db)` returns async `init()`, `reserve({id,provider,operation,fixtureId,ceilingMicrousd,maxAttempts,priceVersion})` => `{admitted,reason,reservationId}`; `recordAttempt({reservationId,kind})` => `{admitted,attemptId,reason}`; `settle({reservationId,status,estimatedMicrousd,inputTokens,outputTokens,errorCode})`, status `succeeded|unbilled|billing_unknown`; `pause(provider,reason)`; `summary()`; `rows()`.

Atomic reserve reserves both cost and potential HTTP slots including in-flight reservations. Each send is recorded before fetch, cap1000 counts all sent Metaattempts; unsent slots release after operation settlement but sent attempts never disappear. Paused or denied calls never fetch. Unknownbilling keeps ceilingandpausesprovider. SingleSQLadmission/D1transaction; noapp-levelrace. Requestididempotency conflictdenied nofetch. Costs safeintegers. Allledgerrowsimmutablecosthistory acrossinit/resume/cleanup. Costthresholdsoftstop enforce defaults; tests canusefullcap onlyexplicitcapTest flag? Prefer no productionconfigoverride; testnearsoftstop. Meaningful cap999/1000 tests direct SQLfixture seeds, notadminreset.

`openEvaluationRuntime({persistPath})` from runtime.mjs => `{ledger,db,close}` backed by real Miniflare D1 `d1Persist:persistPath`; initializes schema idempotently. No networkfetch there. Lead uses persistentpath `.local-state/evaluation-d1`. No Worker deployment adds evalbindings.

## Fixture worker

Own `tests/fixtures/evaluation/`, `tests/evaluation/scenarios.test.mjs`, `scripts/evaluation-offline.mjs`. Export `scenarios` exactly1000 records `{id,area,description,kind,input,expected}` in `tests/fixtures/evaluation/manifest.mjs`, and `liveCases` array useful smallsyntheticchat/extract specs. Livecases `{id,operation:'chat'|'extract',purpose?,facts?,history?,file?,expected}`. File nativePDFdataURI canbecreatedasync helper `buildLiveCases()` exported. Use PDF-lib for syntheticfixtures textstraightdocument explicitlyfictional, validPNG/JPGfixturesusealreadygeneratedlocalfiles or buildSVGnotunsupported byapp; don'tuseimagegenpaid. Allgroundtruth manuallydefined, parseroutputmocktests don'tclaimOCR. Explicitareas extraction300 intake250 explanation150 routing150 security100 budget50. Distinctcaseaxesandexpected meaningful, not1000renamedsameinput. No providercalls. Do not modifyexistingserver/UI/package.

## Lead

Own `scripts/evaluation-live.mjs`, `server/evaluation/providers.mjs`, providerlookup/configdocs, package/files deployment/reporting and existingcodefixes. Uses schemaexporthelpers `createExtractionPayload/parseExtraction`, `createChatPayload/parseChatResult` actualproductionprompt. PrivateharnesshasnoTurnstileorpublicauthgate and doesnotpretendpublicintegrationverified. Doesnotcallservicewithdummycontrols. Metered transportfixed HTTPSproviderhosts, no SDKautomaticretry. All network calls includingmetadata auth throughledger recordAttempt; potentialbillableallowancebeforefirstcall. Writes syntheticresultsonly in `.local-state/evaluation/`, reportssafeIDs usagecostsstatus.
