import { UnsignedTransaction } from "@nautilus-js/eip12-types";
import { JSONBI } from "./nodeService";

let ergolib: any;

if (typeof window !== "undefined") {
  ergolib = import("ergo-lib-wasm-browser");
} else {
  ergolib = import("ergo-lib-wasm-nodejs");
}

async function getBoxValue(val: any) {
  const resolvedLib = await ergolib;
  return resolvedLib.BoxValue.from_i64(resolvedLib.I64.from_str(val.toString()));
}

async function addressToContract(address: string) {
  const resolvedLib = await ergolib;
  return resolvedLib.Contract.pay_to_address(resolvedLib.Address.from_mainnet_str(address));
}

async function jsToCandidate(out: any, height: number) {
  const resolvedLib = await ergolib;
  const tree = resolvedLib.ErgoTree.from_base16_bytes(out.ergoTree);
  const address = resolvedLib.Address.recreate_from_ergo_tree(tree).to_base58(resolvedLib.NetworkPrefix.Mainnet);
  const boxVal = await getBoxValue(out.value);
  const contract = await addressToContract(address);
  const myOut = new resolvedLib.ErgoBoxCandidateBuilder(boxVal, contract, height);

  if (out.assets === undefined) out.assets = [];
  for (const i of out.assets) {
    const tokAm = resolvedLib.TokenAmount.from_i64(resolvedLib.I64.from_str(i.amount.toString()));
    myOut.add_token(resolvedLib.TokenId.from_str(i.tokenId), tokAm);
  }
  if (out.additionalRegisters === undefined) out.additionalRegisters = {};

  const vals: any = Object.values(out.additionalRegisters);
  for (let i = 0; i < vals.length; i++) {
    myOut.set_register_value(i + 4, resolvedLib.Constant.decode_from_base16(vals[i].toString()));
  }
  return myOut.build();
}

async function idToBoxId(id: string) {
  const resolvedLib = await ergolib;
  return resolvedLib.BoxId.from_str(id);
}

/**
 * get outbox from tree and value
 * @param tree ergo tree
 * @param ergVal value
 */
export async function getOutBoxJs(tree: string, ergVal: number) {
  return {
    value: ergVal,
    ergoTree: tree,
    extension: {},
    additionalRegisters: {},
  };
}

function getTokens(assets: any) {
  const inTokens: any = {};
  assets.forEach((asset: any) => {
    const tid = asset.tokenId;
    if (!(tid in inTokens)) {
      inTokens[tid] = BigInt(0);
    }
    inTokens[tid] += BigInt(asset.amount);
  });
  return inTokens;
}

/**
 * get unsigned tx from inputs, outputs, dInputs and fee
 * @param inputs inputs to the tx
 * @param outputs outputs to the tx
 * @param dInputs data inputs to the tx
 * @param fee miner fee
 * @param realHeight current height of the blockchain
 */
export async function jsToUnsignedTx(inputs: any, outputs: any, dInputs: any, fee: Number, realHeight: number = 0) {
  const resolvedLib = await ergolib;
  var height = Math.max(...inputs.map((i: any) => i.creationHeight));
  const unsignedInputs = new resolvedLib.UnsignedInputs();
  for (const box of inputs) {
    const unsignedInput = resolvedLib.UnsignedInput.from_box_id(await idToBoxId(box.boxId));
    unsignedInputs.add(unsignedInput);
  }

  const dataInputs = new resolvedLib.DataInputs();
  for (const d of dInputs) dataInputs.add(new resolvedLib.DataInput(await idToBoxId(d.boxId)));

  const unsignedOutputs = resolvedLib.ErgoBoxCandidates.empty();
  for (const i of outputs) {
    const box = await jsToCandidate(i, height);
    unsignedOutputs.add(box);
  }
  const feeBox = resolvedLib.ErgoBoxCandidate.new_miner_fee_box(await getBoxValue(fee), height);
  unsignedOutputs.add(feeBox);

  const unsignedTx = new resolvedLib.UnsignedTransaction(unsignedInputs, dataInputs, unsignedOutputs);
  return unsignedTx;
}

/**
 * get change box from inputs, outputs, changeTree and fee
 * @param ins inputs to the tx except the change box
 * @param outs outputs to the tx except the change box
 * @param changeTree ergo tree of the change box
 * @param fee miner fee
 */
export function getChangeBoxJs(ins: any, outs: any, changeTree: string, fee: number) {
  const inVal = ins.reduce((acc: number, i: any) => acc + Number(i.value), 0);
  const outVal = outs.reduce((acc: number, i: any) => acc + Number(i.value), 0);
  const inTokens = getTokens(
    ins
      .map((i: any) => i.assets)
      .flat()
      .filter((assets: any) => assets !== undefined)
  );
  const outTokens = getTokens(
    outs
      .map((i: any) => i.assets)
      .flat()
      .filter((assets: any) => assets !== undefined)
  );

  const keys = new Set(Object.keys(inTokens).concat(Object.keys(outTokens)));

  keys.forEach((tokenId) => {
    if (!(tokenId in inTokens)) {
      inTokens[tokenId] = BigInt(0);
    }
    if (tokenId in outTokens) {
      inTokens[tokenId] -= outTokens[tokenId];
    }
  });
  let assets = Object.keys(inTokens)
    .map((tokenId) => {
      return { tokenId, amount: inTokens[tokenId] };
    })
    .filter((i: any) => i.amount > 0);

  if (inVal - outVal - fee < 0 || Object.values(inTokens).filter((i: any) => i < 0).length > 0) {
    throw new Error("Not enough funds");
  }

  assets = assets.filter((i: any) => i.amount > 0);
  return {
    value: inVal - outVal - fee,
    ergoTree: changeTree,
    assets: assets,
  };
}

/**
 * signs the tx if no secrets are needed; useful for combining contracts that require only satisfying some conditions
 * @param unsignedTx unsigned tx
 * @param boxes boxes to sign
 * @param dataInptus data inputs
 * @param ctx ErgoStateContext
 */
export async function signTx(unsignedTx: UnsignedTransaction, boxes: any, dataInputs: any, ctx: any): Promise<any> {
  const resolvedLib = await ergolib;
  const wallet = resolvedLib.Wallet.from_secrets(new resolvedLib.SecretKeys());
  return wallet.sign_transaction(ctx, unsignedTx, boxes, dataInputs);
}

/**
 * signs the tx if secrets are needed; useful for combining contracts that require satisfying all conditions
 * @param inputsJs inputs to the tx
 * @param outsJs outputs to the tx
 * @param dataInptusJs data inputs to the tx
 * @param ctx ErgoStateContext
 */
export async function signTxJs(inputsJs: any, outsJs: any, dataInputsJs: any, ctx: any): Promise<any> {
  const resolvedLib = await ergolib;
  const inVal = inputsJs.reduce((acc: number, i: any) => acc + Number(i.value), 0);
  const outVal = outsJs.reduce((acc: number, i: any) => acc + Number(i.value), 0);
  const rFee = inVal - outVal;

  const unsignedTx = await jsToUnsignedTx(inputsJs, outsJs, dataInputsJs, rFee);
  const boxes = resolvedLib.ErgoBoxes.empty();
  for (const i of inputsJs) {
    const box = resolvedLib.ErgoBox.from_json(JSONBI.stringify(i));
    boxes.add(box);
  }
  const dataInputs = resolvedLib.ErgoBoxes.from_boxes_json(dataInputsJs);
  return signTx(unsignedTx, boxes, dataInputs, ctx);
}

export async function unsignedToEip12Tx(tx: any, ins: any, dataInput: any): Promise<any> {
  const resolvedLib = await ergolib;
  const txJs = tx.to_js_eip12();
  for (let i = 0; i < txJs.inputs.length; i++) {
    const prevExtension = txJs.inputs[i].extension;
    txJs.inputs[i] = resolvedLib.ErgoBox.from_json(JSONBI.stringify(ins[i])).to_js_eip12();
    if (prevExtension !== undefined) txJs.inputs[i].extension = prevExtension;
  }
  for (let i = 0; i < txJs.outputs.length; i++)
    if (txJs.outputs[i].extension === undefined) txJs.outputs[i].extension = {};

  txJs.dataInputs[0] = resolvedLib.ErgoBox.from_json(JSONBI.stringify(dataInput)).to_js_eip12();
  txJs.dataInputs[0].extension = {};

  return txJs;
}
