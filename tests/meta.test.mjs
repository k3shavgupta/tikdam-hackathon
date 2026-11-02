import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFile, createMetaClient } from "../server/meta.mjs";
import {readFile} from "node:fs/promises";
const png = "data:image/png;base64,"+(await readFile(new URL("./fixtures/evaluation/fictional-invoice.png",import.meta.url))).toString("base64");
test("rejects external file URLs instead of fetching them", async () => {
  await assert.rejects(
    () =>
      validateFile({ name: "bill.png", data: "https://example.com/bill.png" }),
    /file|format/i,
  );
});
test("rejects a file whose declared image format has wrong magic bytes", async () => {
  await assert.rejects(
    () =>
      validateFile({
        name: "bill.png",
        data: "data:image/png;base64,SGVsbG8=",
      }),
    /format|contents/i,
  );
});
test("missing credentials produces explicit error without network call", async () => {
  await assert.rejects(
    () =>
      createMetaClient({ key: "" }).extract({ name: "bill.png", data: png }),
    /not configured/i,
  );
});
test("image requests stay inline and schema output is validated", async () => {
  let request;
  const fake = async (url, opts) => {
    request = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  invoiceNumber: "INV-1",
                  invoiceDate: null,
                  supplierName: "Paper shop",
                  supplierTaxId: null,
                  buyerName: null,
                  country: null,
                  currency: "GBP",
                  item: "Paper",
                  net: "100",
                  tax: "20",
                  gross: "120",
                  amountReceived: null,
                  withheld: null,
                  documentType: "invoice",
                  confidence: "medium",
                  uncertainties: ["Buyer name unreadable"],
                }),
              },
            ],
          },
        ],
      }),
    };
  };
  const r = await createMetaClient({
    key: "test-key",
    fetchImpl: fake,
  }).extract({ name: "bill.png", data: png });
  assert.equal(r.fields.tax, "20");
  assert.equal(request.store, false);
  assert.equal(request.input[0].content[1].type, "input_image");
  assert.equal(request.text.format.type, "json_schema");
  assert.match(request.instructions, /untrusted/i);
  assert.equal(r.fields.invoiceConfirmed, undefined);
});
test("invalid model output cannot become confirmed invoice facts", async () => {
  const fake = async () => ({
    ok: true,
    json: async () => ({
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: '{"tax":"invented"}' }] },
      ],
    }),
  });
  await assert.rejects(
    () =>
      createMetaClient({ key: "test", fetchImpl: fake }).extract({
        name: "bill.png",
        data: png,
      }),
    /valid|extract/i,
  );
});

test('image validation rejects signature-only PNG JPEG and WebP before provider processing',async()=>{
 for(const [type,data]of [['png','iVBORw0KGgo='],['jpeg','/9j/AAAAAAA='],['webp','UklGRgAAAABXRUJQ']])await assert.rejects(()=>validateFile({name:`truncated.${type}`,data:`data:image/${type};base64,${data}`}));
});
test('portable image validation accepts real PNG JPEG and WebP fixtures',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const [type,file]of [['png','fictional-invoice.png'],['jpeg','fictional-small.jpg'],['webp','fictional-small.webp']]){
  const data=(await readFile(new URL(`./fixtures/evaluation/${file}`,import.meta.url))).toString('base64');
  const checked=await validateFile({name:file,data:`data:image/${type};base64,${data}`});assert.equal(checked.mime,`image/${type}`);
 }
});
test('image structure checks reject truncated bodies corrupted lengths and oversized dimensions',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const [type,file]of [['png','fictional-invoice.png'],['jpeg','fictional-small.jpg'],['webp','fictional-small.webp']]){
  const bytes=await readFile(new URL(`./fixtures/evaluation/${file}`,import.meta.url));
  const check=body=>validateFile({name:file,data:`data:image/${type};base64,${body.toString('base64')}`});
  await assert.rejects(()=>check(bytes.subarray(0,bytes.length-2)));
  const broken=Buffer.from(bytes);if(type==='png')broken.writeUInt32BE(0xffffffff,8);else if(type==='jpeg')broken.writeUInt16BE(0xffff,4);else broken.writeUInt32LE(0xffffffff,4);
  await assert.rejects(()=>check(broken));
 }
 const png=await readFile(new URL('./fixtures/evaluation/fictional-invoice.png',import.meta.url));
 const {crc32}=await import('node:zlib');
 const huge=Buffer.from(png);huge.writeUInt32BE(16001,16);huge.writeUInt32BE(crc32(huge.subarray(12,29)),29);await assert.rejects(()=>validateFile({name:'huge.png',data:'data:image/png;base64,'+huge.toString('base64')}));
});

test('image dimension checks reject valid-container pixel bombs and checksum corruption',async()=>{
 const {crc32}=await import('node:zlib');
 const png=await readFile(new URL('./fixtures/evaluation/fictional-invoice.png',import.meta.url));
 const pixelBomb=Buffer.from(png);pixelBomb.writeUInt32BE(6000,16);pixelBomb.writeUInt32BE(6000,20);pixelBomb.writeUInt32BE(crc32(pixelBomb.subarray(12,29)),29);
 await assert.rejects(()=>validateFile({name:'bomb.png',data:'data:image/png;base64,'+pixelBomb.toString('base64')}),/dimensions/);
 const corrupt=Buffer.from(png);corrupt[corrupt.length-1]^=1;await assert.rejects(()=>validateFile({name:'bad.png',data:'data:image/png;base64,'+corrupt.toString('base64')}),/integrity/);
 const jpg=await readFile(new URL('./fixtures/evaluation/fictional-small.jpg',import.meta.url));let at=2;while(at<jpg.length){while(jpg[at]===255)at++;const marker=jpg[at++];if([0xc0,0xc2].includes(marker)){const big=Buffer.from(jpg);big.writeUInt16BE(16001,at+5);await assert.rejects(()=>validateFile({name:'big.jpg',data:'data:image/jpeg;base64,'+big.toString('base64')}),/dimensions/);break;}at+=jpg.readUInt16BE(at);}
});

test('image structure validation executes in a bundled Workers runtime for all supported formats',async()=>{
 const {build}=await import('esbuild');const {Miniflare,convertV4MiniflareOptions}=await import('miniflare');
 const bundle=await build({stdin:{contents:`import {validateFile} from './meta.mjs'; export default {async fetch(request){try{const checked=await validateFile(await request.json());return Response.json({mime:checked.mime,pages:checked.pages});}catch{return Response.json({error:'INVALID_IMAGE'},{status:400});}}}`,resolveDir:new URL('../server/',import.meta.url).pathname,loader:'js'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*']});
 const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat']}));
 try{
  for(const [type,file]of [['png','fictional-invoice.png'],['jpeg','fictional-small.jpg'],['webp','fictional-small.webp']]){
   const bytes=await readFile(new URL(`./fixtures/evaluation/${file}`,import.meta.url));const request=data=>runtime.dispatchFetch('https://fixture.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file,data:`data:image/${type};base64,${data.toString('base64')}`})});
   assert.equal((await request(bytes)).status,200,type);assert.equal((await request(bytes.subarray(0,8))).status,400,type+' truncated');
  }
 }finally{await runtime.dispose();}
});
