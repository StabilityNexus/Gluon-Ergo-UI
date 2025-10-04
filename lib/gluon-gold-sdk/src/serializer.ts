import { ErgoTree } from "@nautilus-js/eip12-types";
import { NETWORK } from "./consts";

let ergolib: any;

if (typeof window !== "undefined") {
  ergolib = import("ergo-lib-wasm-browser");
} else {
  ergolib = import("ergo-lib-wasm-nodejs");
}

export class Serializer {
  networkPrefix = NETWORK === "mainnet" ? 0 : 1;
  constructor() {}

  async decodeTree(encodedTree: string): Promise<ErgoTree> {
    const byteArray = (await ergolib).Constant.decode_from_base16(encodedTree).to_byte_array();
    return (await ergolib).ErgoTree.from_bytes(byteArray);
  }

  async treeToAddrs(tree: ErgoTree): Promise<string> {
    return (await ergolib).Address.recreate_from_ergo_tree(tree).to_base58(this.networkPrefix);
  }

  async encodeNumber(num: number): Promise<string> {
    const num64 = (await ergolib).I64.from_str(num.toString());
    return (await ergolib).Constant.from_i64(num64).encode_to_base16();
  }

  async decodeCollLong(encodedColl: string): Promise<number[]> {
    return (await ergolib).Constant.decode_from_base16(encodedColl)
      .to_js()
      .map((x: any) => Number(x));
  }

  async encodeCollLong(coll: number[]): Promise<string> {
    const collStr = coll.map((x: number) => x.toString());
    return (await ergolib).Constant.from_i64_str_array(collStr).encode_to_base16();
  }

  async encodeTupleLong(a: number, b: number): Promise<string> {
    const a64 = (await ergolib).I64.from_str(a.toString());
    const b64 = (await ergolib).I64.from_str(b.toString());
    return (await ergolib).Constant.from_tuple_i64(a64, b64).encode_to_base16();
  }

  async decodeCollByte(encodedColl: string): Promise<string[]> {
    return (await ergolib).Constant.decode_from_base16(encodedColl)
      .to_js()
      .map((x: any) => Buffer.from(x).toString("hex"));
  }

  async decodeJs(encodedColl: string): Promise<any> {
    return (await ergolib).Constant.decode_from_base16(encodedColl).to_js();
  }

  async decodeId(encodedId: string): Promise<string> {
    const bytes = (await ergolib).Constant.decode_from_base16(encodedId).to_byte_array();
    return Buffer.from(bytes).toString("hex");
  }

  async encodeId(id: string): Promise<string> {
    return (await ergolib).Constant.from_byte_array(Buffer.from(id, "hex")).encode_to_base16();
  }
}
