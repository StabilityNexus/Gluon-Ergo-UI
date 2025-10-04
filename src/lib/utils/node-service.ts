import axios, { AxiosInstance } from "axios";
import JSONbig from "json-bigint";
export const JSONBI = JSONbig({ useNativeBigInt: true });
let ergolib: any;

if (typeof window !== "undefined") {
  ergolib = import("ergo-lib-wasm-browser");
} else {
  ergolib = import("ergo-lib-wasm-nodejs");
}

export class NodeService {
  private backend: AxiosInstance;
  private apiKey = "";

  constructor(url: string) {
    this.backend = axios.create({
      baseURL: url,
      transformResponse: (data: any) => JSONBI.parse(data),
      timeout: 2000,
      headers: { "Content-Type": "application/json" },
    });
  }

  async get(url: string, headers?: any, params?: any) {
    return this.backend
      .get(url, {
        timeout: 25000,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        params,
      })
      .then((res: any) => res.data);
  }

  async head(url: string) {
    return this.backend
      .head(url, {
        timeout: 1000,
      })
      .then((res: any) => res.status)
      .catch((e: any) => e.response?.status || 500);
  }

  async post(url: string, headers?: any, params?: any) {
    this.backend.defaults.headers = {
      "Content-Type": "application/json",
      ...headers,
    };
    this.backend.defaults.timeout = 25000;
    return this.backend.post(url, params).then((res: any) => res);
  }

  async getAuthorized(url: string, params: any) {
    return this.get(url, { api_key: this.apiKey }, params);
  }

  async checkUnconfirmedTx(id: string) {
    return this.head(`/transactions/unconfirmed/${id}`);
  }

  async postAuthorized(url: string, params: any) {
    return this.post(url, { api_key: this.apiKey }, params);
  }

  async getUnspentBoxByTokenId(tokenId: string) {
    return this.get(`/blockchain/box/unspent/byTokenId/${tokenId}`);
  }

  async getTokenInfo(tokenId: string) {
    return this.get(`/blockchain/token/byId/${tokenId}`);
  }

  async getWalletTxsByScanId(
    scanId: number,
    minInclusionHeight?: number,
    maxInclusionHeight?: number,
    minConfirmations?: number,
    maxConfirmations?: number
  ): Promise<any> {
    return this.getAuthorized(`/wallet/transactionsByScanId/${scanId}`, {
      minInclusionHeight,
      maxInclusionHeight,
      minConfirmations,
      maxConfirmations,
    });
  }

  async getSpentBoxesByScanId(
    scanId: number,
    minInclusionHeight?: number,
    maxInclusionHeight?: number,
    minConfirmations?: number,
    maxConfirmations?: number
  ): Promise<any> {
    return this.getAuthorized(`/scan/spentBoxes/${scanId}`, {
      minInclusionHeight,
      maxInclusionHeight,
      minConfirmations,
      maxConfirmations,
    });
  }

  async getUnSpentBoxesByScanId(
    scanId: number,
    minInclusionHeight?: number,
    maxInclusionHeight?: number,
    minConfirmations?: number,
    maxConfirmations?: number
  ): Promise<any> {
    return this.getAuthorized(`/scan/unspentBoxes/${scanId}`, {
      minInclusionHeight,
      maxInclusionHeight,
      minConfirmations,
      maxConfirmations,
    });
  }

  async getUnSpentBoxesByAddress(address: string, offset: number, limit: number, sortDirection = "desc"): Promise<any> {
    return this.post(
      `/blockchain/box/unspent/byAddress?offset=${offset}&limit=${limit}&sortDirection=${sortDirection}`,
      { "Content-Type": "text/plain" },
      `${address}`
    ).then((res) => res.data);
  }

  async getUnconfirmedTxByErgoTree(ergoTree: string, offset: number, limit: number): Promise<any> {
    return this.post(`/transactions/unconfirmed/byErgoTree?offset=${offset}&limit=${limit}`, {}, `${ergoTree}`).then(
      (res) => res.data
    );
  }

  async getInfo(): Promise<any> {
    return this.get("/info");
  }

  async getLastHeadersTimestamp(): Promise<any> {
    const lastHeader = (await this.get("/blocks/lastHeaders/1"))[0];
    return lastHeader.timestamp;
  }

  async getStatus(): Promise<any> {
    return this.getAuthorized("/wallet/status", {});
  }

  async getWalletHeight(): Promise<number> {
    const status = await this.getStatus();
    return status.walletHeight;
  }

  async getNetworkHeight(): Promise<number> {
    const info = await this.get(`/info`);
    return info.fullHeight;
  }

  async getNetworkIndexedHeight(): Promise<number> {
    const info = await this.get(`/blockchain/indexedHeight`);
    return info.indexedHeight;
  }

  async getUTXOBoxByIdWithPool(boxId: string): Promise<any> {
    const data = await this.get(`/utxo/withPool/byId/${boxId}`);
    for (const i of Object.keys(data.additionalRegisters)) {
      data.additionalRegisters[i] = {
        serializedValue: data.additionalRegisters[i],
      };
    }
    return data;
  }

  async getUTXOBoxById(boxId: string): Promise<any> {
    const data = await this.get(`/utxo/byId/${boxId}`);
    for (const i of Object.keys(data.additionalRegisters)) {
      data.additionalRegisters[i] = {
        serializedValue: data.additionalRegisters[i],
      };
    }
    return data;
  }

  async getBalance(address: string): Promise<any> {
    return this.post(`/blockchain/balance`, { "Content-Type": "text/plain" }, `${address}`).then((res) => res.data);
  }

  async getHeaderIdByHeight(height: number): Promise<string> {
    return (await this.get(`/blocks/at/${height}`))[0];
  }

  async getInfoByHeight(height: number): Promise<any> {
    const HeaderId = await this.getHeaderIdByHeight(height);
    return this.get(`/blocks/${HeaderId}/header`);
  }

  async checkTransaction(tx: any): Promise<any> {
    return this.post(`transactions/check`, [], tx);
  }

  async chainSliceInfo(height: number): Promise<any> {
    return this.get(`blocks/chainSlice?fromHeight=${height - 10}&toHeight=${height}`);
  }

  async getBoxById(Id: string) {
    const data = await this.get(`/blockchain/box/byId/${Id}`);
    return data;
  }

  async getTokenById(Id: string) {
    return await this.get(`/blockchain/token/byId/${Id}`);
  }

  async getTxsById(Id: string) {
    return await this.get(`/blockchain/transaction/byId/${Id}`);
  }

  async postTransaction(tx: any): Promise<any> {
    return this.post(`transactions`, [], tx).then((res) => res.data);
  }

  async p2s(body: any): Promise<any> {
    return this.postAuthorized(`script/p2sAddress`, body).then((res) => res.data.address);
  }

  async getTransactionById(id: string): Promise<any> {
    return this.getAuthorized(`/wallet/transactionById`, {
      id,
    });
  }

  async getUnconfirmedTransactionById(id: string): Promise<any> {
    return this.get(`/transactions/unconfirmed/byTransactionId/${id}`, null);
  }

  async getBlockInfo(blockHeight: number): Promise<any> {
    const blockId = (await this.get(`/blocks/at/${blockHeight}`))[0];
    return await this.get(`/blocks/${blockId}`);
  }

  async getCtx() {
    const height = await this.getNetworkHeight();
    const blockHeaders = (await ergolib).BlockHeaders.from_json(await this.chainSliceInfo(height));
    const pre_header = (await ergolib).PreHeader.from_block_header(blockHeaders.get(blockHeaders.len() - 1));
    return new (await ergolib).ErgoStateContext(pre_header, blockHeaders);
  }
}
