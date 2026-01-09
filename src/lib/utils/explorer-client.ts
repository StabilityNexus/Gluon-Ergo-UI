

import axios, { AxiosInstance } from "axios";

export class ExplorerClient {
  private client: AxiosInstance;

  constructor(baseURL: string = "https://api.ergoplatform.com") {
    this.client = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }


  async getApiV1BlocksHeaders(params?: { limit?: number; offset?: number }) {
    const limit = params?.limit || 10;
    const offset = params?.offset || 0;
    return this.client.get(`/api/v1/blocks/headers`, {
      params: { limit, offset },
    });
  }

 
  async getApiV1AddressesP1Boxes(address: string, params?: { offset?: number; limit?: number }) {
    const offset = params?.offset || 0;
    const limit = params?.limit || 50;
    return this.client.get(`/api/v1/boxes/unspent/byAddress/${address}`, {
      params: { offset, limit },
    });
  }

  
  async getApiV1AddressesP1BalanceTotal(address: string) {
    return this.client.get(`/api/v1/addresses/${address}/balance/total`);
  }
}

export const explorerClient = new ExplorerClient();
