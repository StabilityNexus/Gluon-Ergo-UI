import { GluonBox } from "./gluonBox";
import { getChangeBoxJs, getOutBoxJs, jsToUnsignedTx, unsignedToEip12Tx } from "./txUtils";
import { Config } from "./config";
import { JSONBI, NodeService } from "./nodeService";
import { GoldOracleBox } from "./goldOracleBox";
// import { Constant, ErgoBox, ErgoStateContext, Transaction, UnsignedTransaction } from "ergo-lib-wasm-nodejs";
import { UnsignedTransaction } from "@nautilus-js/eip12-types";
let ergolib: any;

if (typeof window !== "undefined") {
  ergolib = import("ergo-lib-wasm-browser");
} else {
  ergolib = import("ergo-lib-wasm-nodejs");
}

export class Gluon {
  config: Config;
  nodeService: NodeService;

  /**
   * creates Gluon instance to interact with the protocol
   * @param gluonConfig - configuration for the Gluon instance
   */
  constructor(gluonConfig: Config = new Config()) {
    this.config = gluonConfig;
    this.nodeService = new NodeService(this.config.NODE_URL);
  }

  private async getDecayedDevFee(gluonBox: GluonBox, devFee: number): Promise<number> {
    const fees = await gluonBox.getFees();
    const maxFee = fees[1];
    const maxFeeMinusRepaid = BigInt(maxFee - fees[0]);
    const devFeeMultiplyMaxFeeMinusRepaid = BigInt(devFee) * maxFeeMinusRepaid;
    const decayed = devFeeMultiplyMaxFeeMinusRepaid / BigInt(maxFee);
    return Math.floor(Number(decayed));
  }

  /**
   * get dev fee for the transaction either fission or fusion
   * @param gluonBox
   * @param ergVal
   */
  async getDevFee(gluonBox: GluonBox, ergVal: number): Promise<number> {
    return await this.getDecayedDevFee(gluonBox, Math.floor(Number((this.config.DEV_FEE * ergVal) / 1e5)));
  }

  /**
   * get fee boxes for the transaction either fission or fusion
   * @param gluonBox - input gluon box
   * @param ergVal - erg value of the transaction
   * @param withOracleFee whether to include oracle fee or not
   */
  async getFeeBoxes(gluonBox: GluonBox, ergVal: number, withOracleFee: boolean = true): Promise<{ devFee?: any; uiFee?: any; oracleFee?: any }> {
    const fees: { devFee?: any; uiFee?: any; oracleFee?: any } = {};
    const devFee = await this.getDevFee(gluonBox, ergVal);
    fees.devFee = await getOutBoxJs(this.config.DEV_TREE, devFee + this.config.MIN_FEE);
    if (this.config.UI_FEE > 0) fees.uiFee = await getOutBoxJs(this.config.UI_TREE, Math.floor(Number((this.config.UI_FEE * ergVal) / 1e5)) + this.config.MIN_FEE);
    if (this.config.ORACLE_FEE > 0 && withOracleFee)
      fees.oracleFee = await getOutBoxJs(this.config.ORACLE_FEE_TREE, Math.floor(Number((this.config.ORACLE_FEE * ergVal) / 1e5)) + this.config.MIN_FEE);
    return fees;
  }

  /**
   * Get total fee amounts required for the Fission transaction
   * @param gluonBox - input gluon box
   * @param ergToFission - erg value for fission
   * @returns An object containing the following fee amounts:
   * - devFee: The fee for the developer
   * - uiFee: The fee for the UI (if applicable)
   * - oracleFee: The fee for the oracle (always 0 for fission)
   * - minerFee: The fee for the miner
   * - totalFee: The sum of all fees
   */
  async getTotalFeeAmountFission(
    gluonBox: GluonBox,
    ergToFission: number
  ): Promise<{
    devFee: number;
    uiFee: number;
    oracleFee: number;
    minerFee: number;
    totalFee: number;
  }> {
    const feeBoxes = await this.getFeeBoxes(gluonBox, ergToFission, false);
    const devFee = feeBoxes.devFee?.value || 0;
    const uiFee = feeBoxes.uiFee?.value || 0;
    const oracleFee = 0;
    const minerFee = this.config.MINER_FEE || 0;
    const totalFee = devFee + uiFee + oracleFee + minerFee;
    return { devFee, uiFee, oracleFee, minerFee, totalFee };
  }

  /**
   * Get fee percentages for the Fission transaction
   * @param gluonBox - input gluon box
   * @param ergToFission - erg value for fission
   * @returns An object containing the following fee percentages:
   * - devFee: The fee percentage for the developer
   * - uiFee: The fee percentage for the UI (if applicable)
   * - oracleFee: The fee percentage for the oracle (always 0 for fission)
   * - minerFee: The fee percentage for the miner
   * - totalFee: The total fee percentage
   */
  async getFeePercentageFission(
    gluonBox: GluonBox,
    ergToFission: number
  ): Promise<{
    devFee: number;
    uiFee: number;
    oracleFee: number;
    minerFee: number;
    totalFee: number;
  }> {
    const fees = await this.getTotalFeeAmountFission(gluonBox, ergToFission);
    return {
      devFee: fees.devFee / ergToFission,
      uiFee: fees.uiFee / ergToFission,
      oracleFee: fees.oracleFee / ergToFission,
      minerFee: this.config.MINER_FEE / ergToFission,
      totalFee: fees.totalFee / ergToFission,
    };
  }

  /**
   * Get total fee amounts required for the Fusion transaction
   * @param ergToFusion - erg value for fusion
   * @param gluonBox - input gluon box
   * @returns An object containing the following fee amounts:
   * - devFee: The fee for the developer
   * - uiFee: The fee for the UI (if applicable)
   * - oracleFee: The fee for the oracle (always 0 for fusion)
   * - minerFee: The fee for the miner
   * - totalFee: The sum of all fees
   */
  async getTotalFeeAmountFusion(
    gluonBox: GluonBox,
    ergToFusion: number
  ): Promise<{
    devFee: number;
    uiFee: number;
    oracleFee: number;
    minerFee: number;
    totalFee: number;
  }> {
    const feeBoxes = await this.getFeeBoxes(gluonBox, ergToFusion, false);
    const devFee = feeBoxes.devFee?.value || 0;
    const uiFee = feeBoxes.uiFee?.value || 0;
    const oracleFee = 0;
    const minerFee = this.config.MINER_FEE || 0;
    const totalFee = devFee + uiFee + oracleFee + minerFee;
    return { devFee, uiFee, oracleFee, minerFee, totalFee };
  }

  /**
   * Get fee percentages for the Fusion transaction
   * @param gluonBox - input gluon box
   * @param ergToFusion - erg value for fusion
   * @returns An object containing the following fee percentages:
   * - devFee: The fee percentage for the developer
   * - uiFee: The fee percentage for the UI (if applicable)
   * - oracleFee: The fee percentage for the oracle (always 0 for fusion)
   * - minerFee: The fee percentage for the miner
   * - totalFee: The total fee percentage
   */
  async getFeePercentageFusion(
    gluonBox: GluonBox,
    ergToFusion: number
  ): Promise<{
    devFee: number;
    uiFee: number;
    oracleFee: number;
    minerFee: number;
    totalFee: number;
  }> {
    const fees = await this.getTotalFeeAmountFusion(gluonBox, ergToFusion);
    return {
      devFee: fees.devFee / ergToFusion,
      uiFee: fees.uiFee / ergToFusion,
      oracleFee: fees.oracleFee / ergToFusion,
      minerFee: this.config.MINER_FEE / ergToFusion,
      totalFee: fees.totalFee / ergToFusion,
    };
  }

  /**
   * Get total fee amounts required for the Transmute to Gold transaction
   * @param gluonBox - input gluon box
   * @param goldOracleBox - gold oracle box
   * @param protonsToTransmute - number of protons to transmute
   * @returns An object containing the following fee amounts:
   * - devFee: The fee for the developer
   * - uiFee: The fee for the UI (if applicable)
   * - oracleFee: The fee for the oracle
   * - minerFee: The fee for the miner
   * - totalFee: The sum of all fees
   */
  async getTotalFeeAmountTransmuteToGold(
    gluonBox: GluonBox,
    goldOracleBox: GoldOracleBox,
    protonsToTransmute: number
  ): Promise<{
    devFee: number;
    uiFee: number;
    oracleFee: number;
    minerFee: number;
    totalFee: number;
  }> {
    const protonVol = ((await gluonBox.protonPrice(goldOracleBox)) * BigInt(protonsToTransmute)) / BigInt(1e9);
    const feeBoxes = await this.getFeeBoxes(gluonBox, Number(protonVol), true);
    const devFee = feeBoxes.devFee?.value || 0;
    const uiFee = feeBoxes.uiFee?.value || 0;
    const oracleFee = feeBoxes.oracleFee?.value || 0;
    const minerFee = this.config.MINER_FEE || 0;
    const totalFee = devFee + uiFee + oracleFee + minerFee;
    return { devFee, uiFee, oracleFee, minerFee, totalFee };
  }

  /**
   * Get fee percentages for the Transmute to Gold transaction
   * @param gluonBox - input gluon box
   * @param goldOracleBox - gold oracle box
   * @param protonsToTransmute - number of protons to transmute
   * @returns An object containing the following fee percentages:
   * - devFee: The fee percentage for the developer
   * - uiFee: The fee percentage for the UI (if applicable)
   * - oracleFee: The fee percentage for the oracle
   * - minerFee: The fee percentage for the miner
   * - totalFee: The total fee percentage
   */
  async getFeePercentageTransmuteToGold(
    gluonBox: GluonBox,
    goldOracleBox: GoldOracleBox,
    protonsToTransmute: number
  ): Promise<{
    devFee: number;
    uiFee: number;
    oracleFee: number;
    minerFee: number;
    totalFee: number;
  }> {
    const fees = await this.getTotalFeeAmountTransmuteToGold(gluonBox, goldOracleBox, protonsToTransmute);
    const protonVol = ((await gluonBox.protonPrice(goldOracleBox)) * BigInt(protonsToTransmute)) / BigInt(1e9);
    return {
      devFee: fees.devFee / Number(protonVol),
      uiFee: fees.uiFee / Number(protonVol),
      oracleFee: fees.oracleFee / Number(protonVol),
      minerFee: this.config.MINER_FEE / Number(protonVol),
      totalFee: fees.totalFee / Number(protonVol),
    };
  }

  /**
   * Get total fee amounts required for the Transmute from Gold transaction
   * @param gluonBox - input gluon box
   * @param goldOracleBox - gold oracle box
   * @param neutronsToDecay - number of neutrons to decay
   * @returns An object containing the following fee amounts:
   * - devFee: The fee for the developer
   * - uiFee: The fee for the UI (if applicable)
   * - oracleFee: The fee for the oracle
   * - minerFee: The fee for the miner
   * - totalFee: The sum of all fees
   */
  async getTotalFeeAmountTransmuteFromGold(
    gluonBox: GluonBox,
    goldOracleBox: GoldOracleBox,
    neutronsToDecay: number
  ): Promise<{
    devFee: number;
    uiFee: number;
    oracleFee: number;
    minerFee: number;
    totalFee: number;
  }> {
    const neutronVol = ((await gluonBox.neutronPrice(goldOracleBox)) * BigInt(neutronsToDecay)) / BigInt(1e9);
    const feeBoxes = await this.getFeeBoxes(gluonBox, Number(neutronVol), true);
    const devFee = feeBoxes.devFee?.value || 0;
    const uiFee = feeBoxes.uiFee?.value || 0;
    const oracleFee = feeBoxes.oracleFee?.value || 0;
    const minerFee = this.config.MINER_FEE || 0;
    const totalFee = devFee + uiFee + oracleFee + minerFee;
    return { devFee, uiFee, oracleFee, minerFee, totalFee };
  }

  /**
     * Get fee percentages for the Transmute from Gold transaction
     * @param gluonBox - input gluon box
    //  * @param goldOracleBox - gold oracle box
     * @param neutronsToDecay - number of neutrons to decay
     * @returns An object containing the following fee percentages:
     * - devFee: The fee percentage for the developer
     * - uiFee: The fee percentage for the UI (if applicable)
     * - minerFee: The fee percentage for the miner
     * - oracleFee: The fee percentage for the oracle
    */
  async getFeePercentageTransmuteFromGold(
    gluonBox: GluonBox,
    goldOracleBox: GoldOracleBox,
    neutronsToDecay: number
  ): Promise<{
    devFee: number;
    uiFee: number;
    oracleFee: number;
    minerFee: number;
    totalFee: number;
  }> {
    const fees = await this.getTotalFeeAmountTransmuteFromGold(gluonBox, goldOracleBox, neutronsToDecay);
    const neutronVol = ((await gluonBox.neutronPrice(goldOracleBox)) * BigInt(neutronsToDecay)) / BigInt(1e9);
    return {
      devFee: fees.devFee / Number(neutronVol),
      uiFee: fees.uiFee / Number(neutronVol),
      oracleFee: fees.oracleFee / Number(neutronVol),
      minerFee: this.config.MINER_FEE / Number(neutronVol),
      totalFee: fees.totalFee / Number(neutronVol),
    };
  }

  /**
   * get amount of neutrons and protons that will be received after fission
   * @param gluonBox - input gluon box
   * @param ergToFission - erg value of the fission transaction (user request)
   */
  async fissionWillGet(gluonBox: GluonBox, ergToFission: number): Promise<{ neutrons: number; protons: number }> {
    const sNeutrons = await gluonBox.getNeutronsCirculatingSupply();
    const sProtons = await gluonBox.getProtonsCirculatingSupply();
    const ergFissioned = gluonBox.getErgFissioned();
    const outNeutronsAmount = Number((BigInt(ergToFission) * BigInt(sNeutrons) * (BigInt(1e9) - BigInt(1e6))) / BigInt(ergFissioned) / BigInt(1e9));
    const outProtonsAmount = Number((BigInt(ergToFission) * BigInt(sProtons) * (BigInt(1e9) - BigInt(1e6))) / BigInt(ergFissioned) / BigInt(1e9));
    return { neutrons: outNeutronsAmount, protons: outProtonsAmount };
  }

  /**
   * returns fission transaction in the form of UnsignedTransaction
   * change will be sent to the first user box
   * @param gluonBox - gluon box
   * @param userBoxes - user boxes
   * @param oracle - oracle box
   * @param ergToFission - erg value of the fission transaction (user request)
   */
  async fission(gluonBox: GluonBox, oracle: GoldOracleBox, userBoxes: any, ergToFission: number): Promise<UnsignedTransaction> {
    const willGet = await this.fissionWillGet(gluonBox, ergToFission);
    const outNeutronsAmount = willGet.neutrons;
    const outProtonsAmount = willGet.protons;

    const fees = await this.getFeeBoxes(gluonBox, ergToFission, false);

    const outGluonBoxJs = JSONBI.parse(JSONBI.stringify(gluonBox.boxJs));
    const neutInd = gluonBox.neutronInd();
    const protInd = gluonBox.protonInd();
    outGluonBoxJs.assets[neutInd].amount -= BigInt(outNeutronsAmount);
    outGluonBoxJs.assets[protInd].amount -= BigInt(outProtonsAmount);
    outGluonBoxJs.value += ergToFission;
    outGluonBoxJs.additionalRegisters.R6 = await gluonBox.newFeeRegister(await this.getDevFee(gluonBox, ergToFission));

    const feeBoxesArray = Object.values(fees).filter(Boolean);
    const userOutBox = getChangeBoxJs(userBoxes.concat([gluonBox.boxJs]), feeBoxesArray.concat([outGluonBoxJs]), userBoxes[0].ergoTree, this.config.MINER_FEE);
    const outs = [outGluonBoxJs, userOutBox].concat(feeBoxesArray);
    const ins = [gluonBox.boxJs].concat(userBoxes);
    return await jsToUnsignedTx(ins, outs, [oracle.boxJs], this.config.MINER_FEE);
  }

  /**
   * returns fission transaction in the form of json which could be used in the Eip12 wallet without needing change
   * @param gluonBox - gluon box
   * @param oracle - oracle box
   * @param userBoxes - user boxes
   * @param ergToFission - erg value of the fission transaction (user request)
   */
  async fissionForEip12(gluonBox: GluonBox, oracle: GoldOracleBox, userBoxes: any, ergToFission: number): Promise<any> {
    let tx = await this.fission(gluonBox, oracle, userBoxes, ergToFission);
    return await unsignedToEip12Tx(tx, [gluonBox.boxJs].concat(userBoxes), oracle.boxJs);
  }

  /**
   * get amount of neutrons and protons that will be needed for fusion of ergToRedeem amount
   * @param gluonBox - input gluon box
   * @param ergToRedeem - erg value of the fusion transaction (user request)
   */
  async fusionWillNeed(gluonBox: GluonBox, ergToRedeem: number): Promise<{ neutrons: number; protons: number }> {
    const sNeutrons = await gluonBox.getNeutronsCirculatingSupply();
    const sProtons = await gluonBox.getProtonsCirculatingSupply();
    const ergFissioned = gluonBox.getErgFissioned();
    const inNeutronsNumerator = BigInt(ergToRedeem) * BigInt(sNeutrons) * BigInt(1e9);
    const inProtonsNumerator = BigInt(ergToRedeem) * BigInt(sProtons) * BigInt(1e9);
    const denominator = BigInt(ergFissioned) * (BigInt(1e9) - BigInt(5e6));
    const inNeutronsAmount = Number(inNeutronsNumerator / denominator);
    const inProtonsAmount = Number(inProtonsNumerator / denominator);
    return { neutrons: inNeutronsAmount, protons: inProtonsAmount };
  }

  /**
   * returns fusion transaction in the form of UnsignedTransaction
   * change will be sent to the first user box
   * @param gluonBox - input gluon box
   * @param oracle - oracle box
   * @param userBoxes - user boxes
   * @param ergToRedeem - erg value of the fusion transaction (user request)
   */
  async fusion(gluonBox: GluonBox, oracle: GoldOracleBox, userBoxes: any, ergToRedeem: number): Promise<UnsignedTransaction> {
    const willNeed = await this.fusionWillNeed(gluonBox, ergToRedeem);
    const inNeutronsAmount = willNeed.neutrons;
    const inProtonsAmount = willNeed.protons;

    const fees = await this.getFeeBoxes(gluonBox, ergToRedeem, false);

    const outGluonBoxJs = JSONBI.parse(JSONBI.stringify(gluonBox.boxJs));
    const neutInd = gluonBox.neutronInd();
    const protInd = gluonBox.protonInd();
    outGluonBoxJs.assets[neutInd].amount += BigInt(inNeutronsAmount);
    outGluonBoxJs.assets[protInd].amount += BigInt(inProtonsAmount);
    outGluonBoxJs.value -= ergToRedeem;
    outGluonBoxJs.additionalRegisters.R6 = await gluonBox.newFeeRegister(await this.getDevFee(gluonBox, ergToRedeem));

    const feeBoxesArray = Object.values(fees).filter(Boolean);
    const userOutBox = getChangeBoxJs(userBoxes.concat([gluonBox.boxJs]), feeBoxesArray.concat([outGluonBoxJs]), userBoxes[0].ergoTree, this.config.MINER_FEE);
    const outs = [outGluonBoxJs, userOutBox].concat(feeBoxesArray);
    const ins = [gluonBox.boxJs].concat(userBoxes);
    return await jsToUnsignedTx(ins, outs, [oracle.boxJs], this.config.MINER_FEE);
  }

  /**
   * returns fusion transaction in the form of json which could be used in the Eip12 wallet without needing change
   * @param gluonBox - gluon box
   * @param oracle - oracle box
   * @param userBoxes - user boxes
   * @param ergToFusion - erg value of the fusion transaction (user request)
   */
  async fusionForEip12(gluonBox: GluonBox, oracle: GoldOracleBox, userBoxes: any, ergToFusion: number): Promise<any> {
    let tx = await this.fusion(gluonBox, oracle, userBoxes, ergToFusion);
    return await unsignedToEip12Tx(tx, [gluonBox.boxJs].concat(userBoxes), oracle.boxJs);
  }

  /**
   * returns the amount of Neutrons that will be received by transmuting protons
   * @param gluonBox - input gluon box
   * @param goldOracleBox - oracle box
   * @param protonsToTransmute - number of protons to transmute
   * @param height - current height
   */
  async transmuteToGoldWillGet(gluonBox: GluonBox, goldOracleBox: GoldOracleBox, protonsToTransmute: number, height: number): Promise<number> {
    const protonVol = ((await gluonBox.protonPrice(goldOracleBox)) * BigInt(protonsToTransmute)) / BigInt(1e9);
    const volPlus = await gluonBox.addVolume(height, Number(protonVol));
    const volMinus = await gluonBox.subVolume(height, 0);
    const circProtons = await gluonBox.getProtonsCirculatingSupply();
    const circNeutrons = await gluonBox.getNeutronsCirculatingSupply();

    const fusionRatio = await gluonBox.fusionRatio(goldOracleBox);
    const fusionRatioMin = BigInt(1e9) - fusionRatio;
    const phiBetaMin = BigInt(1e9) - gluonBox.varPhiBeta(BigInt(await gluonBox.getErgFissioned()), volPlus, volMinus);

    const ratio1 = (BigInt(protonsToTransmute) * phiBetaMin) / circProtons;
    const ratio2 = (fusionRatioMin * circNeutrons) / BigInt(1e9);
    return Number((ratio1 * ratio2) / fusionRatio);
  }

  /**
   * returns the transaction in the form of UnsignedTransaction for transmuting protons to neutrons
   * @param gluonBox - input gluon box
   * @param goldOracleBox - oracle box
   * @param userBoxes - user boxes
   * @param buybackBoxJs - buyback box
   * @param protonsToTransmute - number of protons to transmute
   * @param height - current height of the network
   */
  async transmuteToGold(
    gluonBox: GluonBox,
    goldOracleBox: GoldOracleBox,
    userBoxes: any,
    buybackBoxJs: any,
    protonsToTransmute: number,
    height: number
  ): Promise<UnsignedTransaction> {
    const outNeutronsAmount = await this.transmuteToGoldWillGet(gluonBox, goldOracleBox, protonsToTransmute, height);

    const protonErgs = ((await gluonBox.protonPrice(goldOracleBox)) * BigInt(protonsToTransmute)) / BigInt(1e9);
    const volPlus = await gluonBox.addVolume(height, Number(protonErgs));
    const volMinus = await gluonBox.subVolume(height, 0);

    const fees = await this.getFeeBoxes(gluonBox, Number(protonErgs));
    const buyBackFee = fees.oracleFee || {};
    buyBackFee.value = (buyBackFee.value || 0) + buybackBoxJs.value;
    buyBackFee.assets = buybackBoxJs.assets;

    const outGluonBoxJs = JSONBI.parse(JSONBI.stringify(gluonBox.boxJs));
    outGluonBoxJs.assets[gluonBox.neutronInd()].amount -= BigInt(outNeutronsAmount);
    outGluonBoxJs.assets[gluonBox.protonInd()].amount += BigInt(protonsToTransmute);
    outGluonBoxJs.additionalRegisters.R6 = await gluonBox.newFeeRegister(await this.getDevFee(gluonBox, Number(protonErgs)));
    outGluonBoxJs.additionalRegisters.R7 = await gluonBox.newVolumeRegister(volPlus);
    outGluonBoxJs.additionalRegisters.R8 = await gluonBox.newVolumeRegister(volMinus);
    outGluonBoxJs.additionalRegisters.R9 = await gluonBox.newLastDayRegister(height);

    const feeBoxesArray = Object.values(fees).filter(Boolean);
    const userOutBox = getChangeBoxJs(userBoxes.concat([gluonBox.boxJs, buybackBoxJs]), feeBoxesArray.concat([outGluonBoxJs]), userBoxes[0].ergoTree, this.config.MINER_FEE);
    const outs = [outGluonBoxJs, userOutBox, buyBackFee].concat(feeBoxesArray.filter((box) => box !== fees.oracleFee));
    const ins = [gluonBox.boxJs].concat(userBoxes).concat([buybackBoxJs]);
    const tx = await jsToUnsignedTx(ins, outs, [goldOracleBox.boxJs], this.config.MINER_FEE, height);
    const txJs = tx.to_js_eip12();
    txJs.inputs[txJs.inputs.length - 1].extension = {
      "0": "0402",
    };
    return (await ergolib).UnsignedTransaction.from_json(JSON.stringify(txJs));
  }

  /**
   * returns the transaction in Eip12 (for use in for example Nautilus) format for transmuting protons to neutrons
   * @param gluonBox - input gluon box
   * @param oracle - oracle box
   * @param userBoxes - user boxes
   * @param buybackBoxJs - buyback box
   * @param protonsToTransmute - number of protons to transmute
   * @param height - current height of the blockchain
   */
  async transmuteToGoldForEip12(gluonBox: GluonBox, oracle: GoldOracleBox, userBoxes: any, buybackBoxJs: any, protonsToTransmute: number, height: number): Promise<any> {
    let tx = await this.transmuteToGold(gluonBox, oracle, userBoxes, buybackBoxJs, protonsToTransmute, height);
    return await unsignedToEip12Tx(tx, [gluonBox.boxJs].concat(userBoxes).concat([buybackBoxJs]), oracle.boxJs);
  }

  /**
   * returns the amount of protons that will be received by decaying neutrons
   * @param gluonBox - input gluon box
   * @param goldOracleBox - oracle box
   * @param neutronsToDecay - number of neutrons to decay
   * @param height - current height of the blockchain
   */
  async transmuteFromGoldWillGet(gluonBox: GluonBox, goldOracleBox: GoldOracleBox, neutronsToDecay: number, height: number): Promise<number> {
    const neutronVol = ((await gluonBox.neutronPrice(goldOracleBox)) * BigInt(neutronsToDecay)) / BigInt(1e9);
    const volPlus = await gluonBox.addVolume(height, 0);
    const volMinus = await gluonBox.subVolume(height, Number(neutronVol));
    const circProtons = await gluonBox.getProtonsCirculatingSupply();
    const circNeutrons = await gluonBox.getNeutronsCirculatingSupply();

    const fusionRatio = await gluonBox.fusionRatio(goldOracleBox);
    const fusionRatioMin = BigInt(1e9) - fusionRatio;
    const phiBetaMin = BigInt(1e9) - gluonBox.varPhiBeta(BigInt(gluonBox.getErgFissioned()), volMinus, volPlus);

    const ratio1 = (BigInt(neutronsToDecay) * phiBetaMin) / circNeutrons;
    const ratio2 = (fusionRatio * circProtons) / BigInt(1e9);
    return Number((ratio1 * ratio2) / fusionRatioMin);
  }

  /**
   * returns the transaction in the form of UnsignedTransaction for decaying neutrons to protons
   * @param gluonBox - input gluon box
   * @param goldOracleBox - oracle box
   * @param userBoxes - user boxes
   * @param buybackBoxJs - buyback box
   * @param neutronsToDecay - number of neutrons to decay
   * @param height - current height of the blockchain
   */
  async transmuteFromGold(
    gluonBox: GluonBox,
    goldOracleBox: GoldOracleBox,
    userBoxes: any,
    buybackBoxJs: any,
    neutronsToDecay: number,
    height: number
  ): Promise<UnsignedTransaction> {
    const outProtonAmount = await this.transmuteFromGoldWillGet(gluonBox, goldOracleBox, neutronsToDecay, height);

    const neutronsErgs = ((await gluonBox.neutronPrice(goldOracleBox)) * BigInt(neutronsToDecay)) / BigInt(1e9);
    const volPlus = await gluonBox.addVolume(height, 0);
    const volMinus = await gluonBox.subVolume(height, Number(neutronsErgs));

    const feesJs = await this.getFeeBoxes(gluonBox, Number(neutronsErgs));
    const fees = Object.values(feesJs).filter(Boolean);
    const buyBackFee = fees[fees.length - 1];
    buyBackFee.value += buybackBoxJs.value;
    buyBackFee.assets = buybackBoxJs.assets;

    const outGluonBoxJs = JSONBI.parse(JSONBI.stringify(gluonBox.boxJs));
    outGluonBoxJs.assets[gluonBox.neutronInd()].amount += BigInt(neutronsToDecay);
    outGluonBoxJs.assets[gluonBox.protonInd()].amount -= BigInt(outProtonAmount);
    outGluonBoxJs.additionalRegisters.R6 = await gluonBox.newFeeRegister(await this.getDevFee(gluonBox, Number(neutronsErgs)));
    outGluonBoxJs.additionalRegisters.R7 = await gluonBox.newVolumeRegister(volPlus);
    outGluonBoxJs.additionalRegisters.R8 = await gluonBox.newVolumeRegister(volMinus);
    outGluonBoxJs.additionalRegisters.R9 = await gluonBox.newLastDayRegister(height);

    const userOutBox = getChangeBoxJs(userBoxes.concat([gluonBox.boxJs, buybackBoxJs]), fees.concat([outGluonBoxJs]), userBoxes[0].ergoTree, this.config.MINER_FEE);
    const outs = [outGluonBoxJs, userOutBox, buyBackFee].concat(fees.slice(0, fees.length - 1));
    const ins = [gluonBox.boxJs].concat(userBoxes).concat([buybackBoxJs]);
    const tx = await jsToUnsignedTx(ins, outs, [goldOracleBox.boxJs], this.config.MINER_FEE, height);
    const txJs = tx.to_js_eip12();
    txJs.inputs[txJs.inputs.length - 1].extension = {
      "0": "0402",
    };
    return (await ergolib).UnsignedTransaction.from_json(JSON.stringify(txJs));
  }

  /**
   * returns the transaction in Eip12 (for use in for example Nautilus) format for decaying neutrons to protons
   * @param gluonBox - gluon box
   * @param oracle - oracle box
   * @param userBoxes - user boxes
   * @param buybackBoxJs - buyback box
   * @param neutronsToDecay - number of neutrons to decay
   * @param height - current height of the blockchain
   */
  async transmuteFromGoldForEip12(gluonBox: GluonBox, oracle: GoldOracleBox, userBoxes: any, buybackBoxJs: any, neutronsToDecay: number, height: number): Promise<any> {
    let tx = await this.transmuteFromGold(gluonBox, oracle, userBoxes, buybackBoxJs, neutronsToDecay, height);
    return await unsignedToEip12Tx(tx, [gluonBox.boxJs].concat(userBoxes).concat([buybackBoxJs]), oracle.boxJs);
  }

  /**
   * get the current unspent gold oracle box
   * works only if valid NODE_URL is set in the config
   */
  async getGoldOracleBox(): Promise<GoldOracleBox> {
    if (!this.config.NODE_URL) throw new Error("NODE_URL is not set");
    const oracleJs = await this.nodeService.getUnspentBoxByTokenId(this.config.ORACLE_POOL_NFT);
    return new GoldOracleBox(oracleJs[0]);
  }

  /**
   * get the current unspent gluon box
   * works only if valid NODE_URL is set in the config
   */
  async getGluonBox(): Promise<GluonBox> {
    if (!this.config.NODE_URL) throw new Error("NODE_URL is not set");
    const gluonJs = await this.nodeService.getUnspentBoxByTokenId(this.config.GLUON_NFT);
    return new GluonBox(gluonJs[0]);
  }

  async getOracleBuyBackBoxJs(): Promise<any> {
    if (!this.config.NODE_URL) throw new Error("NODE_URL is not set");
    const buybackJs = await this.nodeService.getUnspentBoxByTokenId(this.config.ORACLE_BUYBACK_NFT);
    return buybackJs[0];
  }

  /**
   * Calculate the Total Value Locked (TVL) in the protocol
   * @param gluonBox - input gluon box
   * @param goldOracleBox - gold oracle box
   * @returns The total value locked in nanoERG
   */
  async getTVL(gluonBox: GluonBox, goldOracleBox: GoldOracleBox): Promise<bigint> {
    const neutronPrice = await gluonBox.neutronPrice(goldOracleBox);
    const protonPrice = await gluonBox.protonPrice(goldOracleBox);

    const neutronSupply = await gluonBox.getNeutronsCirculatingSupply();
    const protonSupply = await gluonBox.getProtonsCirculatingSupply();

    const neutronValue = (neutronPrice * neutronSupply) / BigInt(1e9);
    const protonValue = (protonPrice * protonSupply) / BigInt(1e9);
    console.log(protonValue / BigInt(1e9));
    console.log(neutronValue / BigInt(1e9));

    return neutronValue + protonValue;
  }

  /**
   * Calculate the reserve ratio of the protocol (proton value / neutron value)
   * @param gluonBox - input gluon box
   * @param goldOracleBox - gold oracle box
   * @returns The reserve ratio in percentage
   */
  async getReserveRatio(gluonBox: GluonBox, goldOracleBox: GoldOracleBox): Promise<number> {
    const neutronPrice = await gluonBox.neutronPrice(goldOracleBox);
    const protonPrice = await gluonBox.protonPrice(goldOracleBox);

    const neutronSupply = await gluonBox.getNeutronsCirculatingSupply();
    const protonSupply = await gluonBox.getProtonsCirculatingSupply();

    const neutronValue = (neutronPrice * neutronSupply) / BigInt(1e9);
    const protonValue = (protonPrice * protonSupply) / BigInt(1e9);

    return (100 * (Number(protonValue) + Number(neutronValue))) / Number(neutronValue);
  }
}
