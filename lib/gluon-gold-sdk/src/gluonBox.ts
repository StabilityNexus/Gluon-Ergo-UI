import { ErgoTree } from "@nautilus-js/eip12-types";
import { Serializer } from "./serializer";
import { BUCKET_LEN, NEUTRON_ID, PROTON_ID } from "./consts";
import { GoldOracleBox } from "./goldOracleBox";

export class GluonBox {
  boxJs: any;
  serializer: Serializer;
  qstar = BigInt(990000000);

  constructor(box: any) {
    this.boxJs = box;
    this.serializer = new Serializer();
  }

  private getRegisters = (): string[] => {
    return ["R4", "R5", "R6", "R7", "R8", "R9"]
      .map((reg) => {
        if (this.boxJs.additionalRegisters[reg]) {
          return this.boxJs.additionalRegisters[reg];
        }
        return "";
      })
      .filter((reg) => reg !== "");
  };

  /**
   * @returns {Promise<number[]>} [volumePlus, volumeMinus]
   */
  async getVolumeProtonsToNeutronsArray(): Promise<number[]> {
    return await this.serializer.decodeCollLong(this.getRegisters()[3]);
  }

  /**
   * @returns {Promise<number[]>} [volumePlus, volumeMinus]
   */
  async getVolumeNeutronsToProtonsArray(): Promise<number[]> {
    return await this.serializer.decodeCollLong(this.getRegisters()[4]);
  }

  /**
   * @returns {Promise<number>} last day of the epoch
   */
  async getLastDay(): Promise<number> {
    return Number(await this.serializer.decodeJs(this.getRegisters()[5]));
  }

  /**
   * @returns {Promise<number[]>} [devFee, maxFee]
   */
  async getFees(): Promise<number[]> {
    return await this.serializer.decodeCollLong(this.getRegisters()[2]);
  }

  /**
   * @returns {Promise<ErgoTree>} dev tree
   */
  async getDevTree(): Promise<ErgoTree> {
    return await this.serializer.decodeTree(this.getRegisters()[1]);
  }

  /**
   * @returns {Promise<bigint[]>} [neutrons, protons]
   */
  async getTotalSupply(): Promise<bigint[]> {
    const decodedJs = await this.serializer.decodeJs(this.getRegisters()[0]);
    return decodedJs.map((x: any) => BigInt(x));
  }

  /**
   * @returns {bigint} neutrons in the box
   */
  getNeutrons(): bigint {
    return BigInt(this.boxJs.assets.filter((asset: any) => asset.tokenId === NEUTRON_ID)[0].amount);
  }

  /**
   * @returns {number} index of neutron in the assets array
   */
  neutronInd(): number {
    return this.boxJs.assets.findIndex((asset: any) => asset.tokenId === NEUTRON_ID);
  }

  /**
   * @returns {bigint} protons in the box
   */
  getProtons(): bigint {
    return BigInt(this.boxJs.assets.filter((asset: any) => asset.tokenId === PROTON_ID)[0].amount);
  }

  /**
   * @returns {number} index of proton in the assets array
   */
  protonInd(): number {
    return this.boxJs.assets.findIndex((asset: any) => asset.tokenId === PROTON_ID);
  }

  /**
   * @returns {bigint} neutrons circulating supply
   */
  async getNeutronsCirculatingSupply(): Promise<bigint> {
    return (await this.getTotalSupply())[0] - this.getNeutrons();
  }

  /**
   * @returns {bigint} protons circulating supply
   */
  async getProtonsCirculatingSupply(): Promise<bigint> {
    return (await this.getTotalSupply())[1] - this.getProtons();
  }

  /**
   * @returns {number} erg fissioned
   */
  getErgFissioned(): number {
    return this.boxJs.value - 1000000;
  }

  /**
   * returns the new register by adding the fee to the current fee
   * @param fee fee to add
   */
  async newFeeRegister(fee: number): Promise<string> {
    const current = await this.getFees();
    current[0] += fee;
    return await this.serializer.encodeTupleLong(current[0], current[1]);
  }

  /**
   * returns the new last day of the epoch
   * @param height current height of the blockchain
   */
  newLastDay(height: number): number {
    return Math.floor(height / 720) * 720;
  }

  /**
   * returns the new last day of the epoch
   * @param height current height of the blockchain
   */
  async newLastDayRegister(height: number): Promise<string> {
    return await this.serializer.encodeNumber(this.newLastDay(height));
  }

  /**
   * returns the fusion ratio, according to the Gluon V2
   * @param goldOracle gold oracle
   */
  async fusionRatio(goldOracle: GoldOracleBox): Promise<bigint> {
    const pricePerGram = await goldOracle.getPricePerGram(); // this is pt
    const fissionedErg = this.getErgFissioned();
    const neutronsInCirculation = await this.getNeutronsCirculatingSupply();
    const q = (neutronsInCirculation * BigInt(pricePerGram)) / BigInt(fissionedErg);
    const qAdjusted = q * BigInt(1e9) / (q + BigInt(1e9) - this.qstar);
    console.log("Fusion Ratio:");
    console.log("  q =     " + q);
    console.log("  qAdj =  " + qAdjusted);
    return q < qAdjusted ? q : qAdjusted;
  }

  /**
   * returns variable phi beta
   * @param rErg fissioned erg
   * @param volumeToBeNegate volume to be negated
   * @param volumeToMinus volume
   */
  varPhiBeta(rErg: bigint, volumeToBeNegate: number[], volumeToMinus: number[]): bigint {
    const phi0 = BigInt(5000000);
    const phi1 = BigInt(1000000000);
    const sumVolumeToBeNegate = volumeToBeNegate.reduce((acc, x) => acc + BigInt(x), BigInt(0));
    const sumVolumeToMinus = volumeToMinus.reduce((acc, x) => acc + BigInt(x), BigInt(0));
    const volume = sumVolumeToBeNegate < sumVolumeToMinus ? BigInt(0) : sumVolumeToBeNegate - sumVolumeToMinus;
    return phi0 + (phi1 * volume) / rErg;
  }

  /**
   * returns the neutron price in nano ERG
   * @param goldOracle gold oracle
   */
  async neutronPrice(goldOracle: GoldOracleBox): Promise<bigint> {
    const neutronsInCirculation = await this.getNeutronsCirculatingSupply();
    const fissonedErg = this.getErgFissioned();
    const fusionRatio = await this.fusionRatio(goldOracle);
    return (fusionRatio * BigInt(fissonedErg)) / neutronsInCirculation;
  }

  /**
   * returns the proton price in nano ERG
   * @param goldOracle gold oracle
   */
  async protonPrice(goldOracle: GoldOracleBox): Promise<bigint> {
    const protonsInCirculation = await this.getProtonsCirculatingSupply();
    const fissonedErg = this.getErgFissioned();
    const fusionRatio = await this.fusionRatio(goldOracle);
    const oneMinusFusionRatio = BigInt(1e9) - fusionRatio;
    return (oneMinusFusionRatio * BigInt(fissonedErg)) / protonsInCirculation;
  }

  /**
   * returns the new volume
   * @param height current height of the blockchain
   * @param curVolume current
   */
  private async newVolume(height: number, curVolume: number[]): Promise<number[]> {
    const lastDayHeight = await this.getLastDay();
    const daysPassed = Math.min(Math.floor((height - lastDayHeight) / 720), BUCKET_LEN);
    let newVol = Array.from({ length: daysPassed }, () => 0).concat(curVolume);
    newVol = newVol.slice(0, BUCKET_LEN);
    return newVol;
  }

  /**
   * encodes the new volume
   * @param volume to be encoded
   */
  async newVolumeRegister(volume: number[]): Promise<string> {
    return await this.serializer.encodeCollLong(volume);
  }

  /**
   * adds volume to the neutrons of gluon box
   * @param height current height of the blockchain
   * @param toAdd volume to be added
   */
  async addVolume(height: number, toAdd: number): Promise<number[]> {
    const curVolumePlus = await this.getVolumeProtonsToNeutronsArray();
    const newVol = await this.newVolume(height, curVolumePlus);
    newVol[0] += toAdd;
    return newVol;
  }

  /**
   * adds volume to the protons of gluon box
   * @param height current height of the blockchain
   * @param toDec
   */
  async subVolume(height: number, toDec: number): Promise<number[]> {
    const curVolumeMinus = await this.getVolumeNeutronsToProtonsArray();
    const newVol = await this.newVolume(height, curVolumeMinus);
    newVol[0] += toDec;
    return newVol;
  }

  /**
   * returns the accumulated volume for the last n days
   * @param days number of days to accumulate (1-BUCKET_LEN)
   */
  async accumulateVolumeProtonsToNeutrons(days: number = BUCKET_LEN): Promise<number> {
    if (days > BUCKET_LEN) throw new Error(`Cannot accumulate volume for more than ${BUCKET_LEN} days`);
    const volume = await this.getVolumeProtonsToNeutronsArray();
    return volume.slice(0, days).reduce((acc, x) => acc + x, 0);
  }

  /**
   * returns the accumulated volume for the last n days
   * @param days number of days to accumulate (1-BUCKET_LEN)
   */
  async accumulateVolumeNeutronsToProtons(days: number = BUCKET_LEN): Promise<number> {
    if (days > BUCKET_LEN) throw new Error(`Cannot accumulate volume for more than ${BUCKET_LEN} days`);
    const volume = await this.getVolumeNeutronsToProtonsArray();
    return volume.slice(0, days).reduce((acc, x) => acc + x, 0);
  }
}
