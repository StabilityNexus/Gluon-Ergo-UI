
import JSONBigInt from 'json-bigint';

type ErgoLibModule = typeof import('ergo-lib-wasm-browser');

let ergolibPromise: Promise<ErgoLibModule> | null = null;

async function getErgoLib(): Promise<ErgoLibModule> {
  const module =
    typeof window !== "undefined"
      ? await import("ergo-lib-wasm-browser")
      : await import("ergo-lib-wasm-nodejs");

  return (module as any).default ?? module;
}

async function loadErgoLib(): Promise<ErgoLibModule> {
  if (!ergolibPromise) {
    ergolibPromise = getErgoLib();
  }

  return ergolibPromise;
}

export async function getTxReducedB64Safe(
  txOrJson: any,
  explorerClient: any,
): Promise<[string, string]> {
  let txId: string | null = null;
  let reducedTx;

  try {
    [txId, reducedTx] = await getTxReduced(txOrJson, explorerClient);
  } catch (e) {
    console.error('Error reducing transaction:', e);
    throw e;
  }

  const txReducedBase64 = byteArrayToBase64(reducedTx.sigma_serialize_bytes());

  const ergoPayTx = txReducedBase64.replace(/\//g, '_').replace(/\+/g, '-');

  return [txId || '', ergoPayTx];
}


function byteArrayToBase64(byteArray: any): string {
  let binary = '';
  const byteLength = byteArray.byteLength;
  for (let i = 0; i < byteLength; i++) {
    binary += String.fromCharCode(byteArray[i]);
  }
  
  if (typeof window !== 'undefined') {
    return window.btoa(binary);
  } else {
    return Buffer.from(binary, 'binary').toString('base64');
  }
}

 async function getTxReduced(
  txOrJson: any,
  explorerClient: any,
): Promise<[string, any]> {
  const lib = await loadErgoLib();
  
  let unsignedTx: any;
  let inputBoxes: any;
  let inputDataBoxes: any;
  
  if (txOrJson.id && typeof txOrJson.id === 'function') {
    unsignedTx = txOrJson;
    inputBoxes = unsignedTx.inputs();
    inputDataBoxes = unsignedTx.data_inputs();
  } else {
    unsignedTx = lib.UnsignedTransaction.from_json(
      JSONBigInt.stringify(txOrJson),
    );
    inputBoxes = lib.ErgoBoxes.from_boxes_json(txOrJson.inputs);
    inputDataBoxes = lib.ErgoBoxes.from_boxes_json(txOrJson.dataInputs);
  }
  
  let ctx: any;
  try {
    ctx = await getErgoStateContext(explorerClient);
  } catch (e) {
    console.error('Error getting Ergo state context:', e);
    throw e;
  }

  const id = unsignedTx.id().to_str();
  const reducedTx = lib.ReducedTransaction.from_unsigned_tx(
    unsignedTx,
    inputBoxes,
    inputDataBoxes,
    ctx,
  );

  return [id, reducedTx];
}

async function getErgoStateContext(explorerClient: any): Promise<any> {
  const lib = await loadErgoLib();
  let explorerHeaders: any = [];
  
  try {
    const response = await explorerClient.getApiV1BlocksHeaders();
    explorerHeaders = response.data.items.slice(0, 10);
  } catch (e) {
    console.error('Error fetching block headers:', e);
    throw e;
  }

  const block_headers = lib.BlockHeaders.from_json(explorerHeaders);
  
  const pre_header = lib.PreHeader.from_block_header(
    block_headers.get(block_headers.len() - 1)
  );

  const parameters = lib.Parameters.default_parameters();

  const ctx = new lib.ErgoStateContext(pre_header, block_headers, parameters);
  return ctx;
}

