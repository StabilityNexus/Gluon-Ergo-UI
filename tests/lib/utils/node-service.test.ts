import { describe, expect, test, mock, beforeEach } from "bun:test";
import { NodeService } from "@/lib/utils/node-service";

// Mock axios
const mockAxios = {
    create: mock(() => mockAxiosInstance),
    get: mock(),
    post: mock(),
    head: mock(),
};

const mockAxiosInstance = {
    get: mock((url: string) => Promise.resolve({ data: { success: true } })),
    post: mock((url: string, data: any) => Promise.resolve({ data: { success: true } })),
    head: mock((url: string) => Promise.resolve({ status: 200 })),
    defaults: {
        headers: {},
        timeout: 2000,
    },
};

mock.module("axios", () => ({
    default: mockAxios,
}));

describe("NodeService", () => {
    let nodeService: NodeService;
    const testUrl = "https://test-node.ergoplatform.com";

    beforeEach(() => {
        // Reset mocks before each test
        mockAxiosInstance.get.mockClear();
        mockAxiosInstance.post.mockClear();
        mockAxiosInstance.head.mockClear();

        nodeService = new NodeService(testUrl);
    });

    describe("Constructor", () => {
        test("should create NodeService instance with URL", () => {
            expect(nodeService).toBeDefined();
        });
    });

    describe("get method", () => {
        test("should make GET request", async () => {
            const mockData = { height: 1000000 };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockData });

            const result = await nodeService.get("/info");

            expect(mockAxiosInstance.get).toHaveBeenCalled();
            expect(result).toEqual(mockData);
        });

        test("should pass headers to GET request", async () => {
            const headers = { "Custom-Header": "value" };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });

            await nodeService.get("/info", headers);

            expect(mockAxiosInstance.get).toHaveBeenCalledWith(
                "/info",
                expect.objectContaining({
                    headers: expect.objectContaining(headers),
                })
            );
        });

        test("should pass params to GET request", async () => {
            const params = { limit: 10 };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });

            await nodeService.get("/blocks", {}, params);

            expect(mockAxiosInstance.get).toHaveBeenCalledWith(
                "/blocks",
                expect.objectContaining({ params })
            );
        });
    });

    describe("post method", () => {
        test("should make POST request", async () => {
            const mockData = { txId: "abc123" };
            mockAxiosInstance.post.mockResolvedValueOnce({ data: mockData });

            const result = await nodeService.post("/transactions", {}, { tx: "data" });

            expect(mockAxiosInstance.post).toHaveBeenCalled();
            expect(result.data).toEqual(mockData);
        });

        test("should pass headers to POST request", async () => {
            const headers = { "Custom-Header": "value" };
            mockAxiosInstance.post.mockResolvedValueOnce({ data: {} });

            await nodeService.post("/transactions", headers, {});

            expect(mockAxiosInstance.defaults.headers).toEqual(
                expect.objectContaining(headers)
            );
        });
    });

    describe("head method", () => {
        test("should make HEAD request and return status", async () => {
            mockAxiosInstance.head.mockResolvedValueOnce({ status: 200 });

            const status = await nodeService.head("/transactions/unconfirmed/abc123");

            expect(mockAxiosInstance.head).toHaveBeenCalled();
            expect(status).toBe(200);
        });

        test("should return error status on failure", async () => {
            mockAxiosInstance.head.mockRejectedValueOnce({
                response: { status: 404 },
            });

            const status = await nodeService.head("/transactions/unconfirmed/notfound");

            expect(status).toBe(404);
        });

        test("should return 500 on network error", async () => {
            mockAxiosInstance.head.mockRejectedValueOnce(new Error("Network error"));

            const status = await nodeService.head("/test");

            expect(status).toBe(500);
        });
    });

    describe("Blockchain API methods", () => {
        test("getInfo should fetch node info", async () => {
            const mockInfo = { fullHeight: 1000000, headersHeight: 1000001 };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockInfo });

            const result = await nodeService.getInfo();

            expect(mockAxiosInstance.get).toHaveBeenCalledWith(
                "/info",
                expect.any(Object)
            );
            expect(result).toEqual(mockInfo);
        });

        test("getNetworkHeight should return full height", async () => {
            const mockInfo = { fullHeight: 1000000 };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockInfo });

            const height = await nodeService.getNetworkHeight();

            expect(height).toBe(1000000);
        });

        test("getUnspentBoxByTokenId should fetch boxes", async () => {
            const tokenId = "abc123";
            const mockBoxes = [{ boxId: "box1" }];
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockBoxes });

            const result = await nodeService.getUnspentBoxByTokenId(tokenId);

            expect(mockAxiosInstance.get).toHaveBeenCalledWith(
                `/blockchain/box/unspent/byTokenId/${tokenId}`,
                expect.any(Object)
            );
            expect(result).toEqual(mockBoxes);
        });

        test("getTokenInfo should fetch token information", async () => {
            const tokenId = "token123";
            const mockToken = { id: tokenId, name: "Test Token" };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockToken });

            const result = await nodeService.getTokenInfo(tokenId);

            expect(mockAxiosInstance.get).toHaveBeenCalledWith(
                `/blockchain/token/byId/${tokenId}`,
                expect.any(Object)
            );
            expect(result).toEqual(mockToken);
        });

        test("checkUnconfirmedTx should check transaction status", async () => {
            const txId = "tx123";
            mockAxiosInstance.head.mockResolvedValueOnce({ status: 200 });

            const status = await nodeService.checkUnconfirmedTx(txId);

            expect(mockAxiosInstance.head).toHaveBeenCalledWith(
                `/transactions/unconfirmed/${txId}`,
                expect.any(Object)
            );
            expect(status).toBe(200);
        });

        test("postTransaction should submit transaction", async () => {
            const tx = { inputs: [], outputs: [] };
            const mockResponse = { data: "txId123" };
            mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

            const result = await nodeService.postTransaction(tx);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                "transactions",
                tx
            );
            expect(result).toBe("txId123");
        });
    });

    describe("Box and Transaction methods", () => {
        test("getBoxById should fetch box by ID", async () => {
            const boxId = "box123";
            const mockBox = { boxId, value: 1000000 };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockBox });

            const result = await nodeService.getBoxById(boxId);

            expect(result).toEqual(mockBox);
        });

        test("getTxsById should fetch transaction by ID", async () => {
            const txId = "tx123";
            const mockTx = { id: txId, inclusionHeight: 1000000 };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockTx });

            const result = await nodeService.getTxsById(txId);

            expect(result).toEqual(mockTx);
        });

        test("getUnconfirmedTransactionById should fetch unconfirmed tx", async () => {
            const txId = "tx123";
            const mockTx = { id: txId };
            mockAxiosInstance.get.mockResolvedValueOnce({ data: mockTx });

            const result = await nodeService.getUnconfirmedTransactionById(txId);

            expect(result).toEqual(mockTx);
        });
    });

    describe("Error handling", () => {
        test("should handle network errors in get", async () => {
            mockAxiosInstance.get.mockRejectedValueOnce(new Error("Network error"));

            await expect(nodeService.get("/info")).rejects.toThrow("Network error");
        });

        test("should handle network errors in post", async () => {
            mockAxiosInstance.post.mockRejectedValueOnce(new Error("Network error"));

            await expect(nodeService.post("/transactions", {}, {})).rejects.toThrow("Network error");
        });
    });
});
