import { ergsToNanoErgs, nanoErgsToErgs } from "@/lib/utils/erg-converter";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { WalletConnector } from "@/lib/components/blockchain/connector/WalletConnector";

let gluon_gold_sdk: any;

if (typeof window !== 'undefined') {
  gluon_gold_sdk = import('gluon-gold-sdk')
}

export default function TestPage() {
  const { getUtxos, SignAndSubmitTx, isConnected } = useErgo();

  const handleTest = async () => {
    try {
      console.log('Test: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      console.log('Test: Gluon instance:', gluon);
    } catch (error) {
      console.error('Test failed:', error);
    }
  }

  const handleFission = async () => {
    // finishing error - prob because i'm on testnet
    const ergAmount = 5 
    try {
      console.log('Fission: Starting... ERG > GAU-GAUC');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const oracleBox = await gluon.getGoldOracleBox();
      const amountToFission = ergsToNanoErgs(ergAmount)
      const utxoInputs = await getUtxos()
      console.log('utxoInputs', utxoInputs)
      const unsignedTransaction = await gluon.fissionForEip12(gluonBox, oracleBox, utxoInputs, amountToFission)
      console.log('unsigned fission transaction', unsignedTransaction)
      console.log('Fission: Boxes:', { gluonBox, oracleBox });
      const signedTransaction = await SignAndSubmitTx(unsignedTransaction)
      console.log('signed transaction', signedTransaction)
    } catch (error) {
      console.error('Fission failed:', error);
    }
  }

  const handleFusion = async () => {
    // must have gau-gauc in the wallet to test properly, not available on testnet
    const ergAmount = 5 
    try {
      console.log('Fusion: Starting... GAU-GAUC > ERG');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const oracleBox = await gluon.getGoldOracleBox();
      const amountToFusion = ergsToNanoErgs(ergAmount)
      const utxoInputs = await getUtxos()
      console.log('utxoInputs', utxoInputs)
      const unsignedTransaction = await gluon.fusionForEip12(gluonBox, oracleBox, utxoInputs, amountToFusion)
      console.log('unsigned fusion transaction', unsignedTransaction)
      console.log('Fusion Boxes:', { gluonBox, oracleBox });
      const signedTransaction = await SignAndSubmitTx(unsignedTransaction)
      console.log('signed transaction', signedTransaction)
    } catch (error) {
      console.error('Fission failed:', error);
    }
  }

  const handleTransmutingToGold = async () => {
    // we need to get the height of the network to get the correct amount of GAU to transmute
    // example: https://github.com/StabilityNexus/Gluon-Ergo-SDK/blob/main/src/test.ts
    const gaucAmount = 5
    try {
      console.log('Transmuting to Gold: Starting... GAUC > GAU');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const oracleBox = await gluon.getGoldOracleBox();
      const oracleBuybackBox = await gluon.getOracleBuyBackBoxJs()
      // const height = node.getNetworkHeight() .. see example
      const height = 1 // remove this
      const utxoInputs = await getUtxos()
      console.log('utxoInputs', utxoInputs)
      const unsignedTransaction = await gluon.transmuteToGoldForEip12(gluonBox, oracleBox, utxoInputs, oracleBuybackBox, gaucAmount, height)
      console.log('unsigned transmute to gold transaction', unsignedTransaction)
      const signedTransaction = await SignAndSubmitTx(unsignedTransaction)
      console.log('signed transaction', signedTransaction)
    } catch (error) {
      console.error('Transmuting to Gold failed:', error);
    }
  }

  const handleTransmutingFromGold = async () => {
    const gauAmount = 5
    try {
      console.log('Transmuting from Gold: Starting... GAU > GAUC');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const oracleBox = await gluon.getGoldOracleBox();
      const oracleBuybackBox = await gluon.getOracleBuyBackBoxJs()
      // const height = node.getNetworkHeight() .. see example
      const height = 1 // remove this
      const utxoInputs = await getUtxos()
      console.log('utxoInputs', utxoInputs)
      const unsignedTransaction = await gluon.transmuteFromGoldForEip12(gluonBox, oracleBox, utxoInputs, oracleBuybackBox, gauAmount, height)
      console.log('unsigned transmute from gold transaction', unsignedTransaction)
      const signedTransaction = await SignAndSubmitTx(unsignedTransaction)
      console.log('signed transaction', signedTransaction)
    } catch (error) {
      console.error('Transmuting from Gold failed:', error);
    }
  }

  const handleGoldPriceKg = async () => {
    try {
      console.log('Gold Price Kg: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const oracleBox = await gluon.getGoldOracleBox();
      const price = await oracleBox.getPrice();
      console.log('Gold Price Kg:', price);
      const converted = nanoErgsToErgs(price)
      console.log('Gold Price Kg in erg:', converted);
    } catch (error) {
      console.error('Gold Price Kg failed:', error);
    }
  }

  const handleGoldPriceGram = async () => {
    try {
      console.log('Gold Price Gram: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const oracleBox = await gluon.getGoldOracleBox();
      const price = await oracleBox.getPricePerGram();
      const converted = nanoErgsToErgs(price)
      console.log('Gold Price Gram in erg:', converted);
      console.log('Gold Price Gram:', price);
    } catch (error) {
      console.error('Gold Price Gram failed:', error);
    }
  }

  const handleGauPrice = async () => {
    try {
      console.log('GAU Price: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const oracleBox = await gluon.getGoldOracleBox();
      const price = await gluonBox.neutronPrice(oracleBox);
      const converted = nanoErgsToErgs(price)
      console.log('GAU Price in erg:', converted);
      console.log('GAU Price:', price);
    } catch (error) {
      console.error('GAU Price failed:', error);
    }
  }

  const handleGaucPrice = async () => {
    try {
      console.log('GAUC Price: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const oracleBox = await gluon.getGoldOracleBox();
      const price = await gluonBox.protonPrice(oracleBox);
      const converted = nanoErgsToErgs(price)
      console.log('GAUC Price in erg:', converted);
      console.log('GAUC Price:', price);
    } catch (error) {
      console.error('GAUC Price failed:', error);
    }
  }

  const handleVolumePN14d = async () => {
    // need to confirm, this value is in nanoErgs? 
    try {
      console.log('Volume PN 14d: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const volume = await gluonBox.accumulateVolumeProtonsToNeutrons(14);
      console.log('Volume PN 14d:', volume);
      const converted = nanoErgsToErgs(volume)
      console.log('Volume PN 14d in erg:', converted);
    } catch (error) {
      console.error('Volume PN 14d failed:', error);
    }
  }

  const handleVolumeNP14d = async () => {
    // need to confirm, this value is in nanoErgs? 
    try {
      console.log('Volume NP 14d: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const volume = await gluonBox.accumulateVolumeNeutronsToProtons(14);
      const converted = nanoErgsToErgs(volume)
      console.log('Volume NP 14d in erg:', converted);
      console.log('Volume NP 14d:', volume);
    } catch (error) {
      console.error('Volume NP 14d failed:', error);
    }
  }

  const handleVolumeArrayPN14d = async () => {
    // need to confirm, this value is in nanoErgs? 
    // returning error: gluon.get14DaysVolumeProtonsToNeutrons() is not a function
    try {
      console.log('Volume Array PN 14d: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const volumeArray = await gluon.get14DaysVolumeProtonsToNeutrons();
      console.log('Volume Array PN 14d:', volumeArray);
    } catch (error) {
      console.error('Volume Array PN 14d failed:', error);
    }
  }

  const handleVolumeArrayNP14d = async () => {
    // returning error: gluon.get14DaysVolumeProtonsToNeutrons() is not a function
    try {
      console.log('Volume Array NP 14d: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const volumeArray = await gluon.get14DaysVolumeProtonsToNeutrons()
      console.log('Volume Array NP 14d:', volumeArray);
    } catch (error) {
      console.error('Volume Array NP 14d failed:', error);
    }
  }

  const handleFusionRatio = async () => {
    // returning error: gluon.getFusionRatio() is not a function
    try {
      console.log('Fusion Ratio: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const oracleBox = await gluon.getGoldOracleBox();
      console.log('gluon', gluon)
      const ratio = await gluon.getFusionRatio(oracleBox);
      console.log('Fusion Ratio:', ratio);
    } catch (error) {
      console.error('Fusion Ratio failed:', error);
    }
  }

  // both uses fees to fusion, working with other actions should look the same 
  // getTotalFeeAmountFission, getTotalFeeAmountTransmuteToGold, getTotalFeeAmountTransmuteFromGold
  const handleFees = async () => {
    const ergToFusion = 5
    try {
      console.log('Fees: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const fees = await gluon.getTotalFeeAmountFusion(gluonBox, ergToFusion);
      console.log('Fees based on 5 erg to fusion:', fees);
    } catch (error) {
      console.error('Fees failed:', error);
    }
  }

  const handleFeesPercentage = async () => {
    const ergToFusion = 5
    try {
      console.log('Fees Percentage: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const feesPercentage = await gluon.getFeePercentageFusion(gluonBox, ergToFusion)
      console.log('Fees Percentage based on 5 erg to fusion:', feesPercentage);
    } catch (error) {
      console.error('Fees Percentage failed:', error);
    }
  }

  const handleTvl = async () => {
    try {
      console.log('TVL: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const oracleBox = await gluon.getGoldOracleBox();
      const tvl = await gluon.getTVL(gluonBox, oracleBox);
      console.log('TVL:', tvl);
    } catch (error) {
      console.error('TVL failed:', error);
    }
  }

  const handleReserveRatio = async () => {
    try {
      console.log('Reserve Ratio in %: Starting...');
      const sdk = await gluon_gold_sdk;
      const gluon = new sdk.Gluon();
      const gluonBox = await gluon.getGluonBox();
      const oracleBox = await gluon.getGoldOracleBox();
      const ratio = await gluon.getReserveRatio(gluonBox, oracleBox)

      console.log('Reserve Ratio:', ratio);
    } catch (error) {
      console.error('Reserve Ratio failed:', error);
    }
  }

  return (
    <>
      <div className='container mx-auto pb-8 space-y-4'>
        <p>Test Page</p>
      </div>
      {isConnected ? (
      <div className="grid grid-cols-4 gap-12">
        <button className="bg-yellow-500 px-2 py-1 rounded-full" onClick={handleFission}>fission</button>
        <button className="bg-red-700 px-2 py-1 rounded-full" onClick={handleFusion}>fusion</button>
        <button className="bg-red-700 px-2 py-1 rounded-full" onClick={handleTransmutingToGold}>transmuting to gold</button>
        <button className="bg-red-700 px-2 py-1 rounded-full" onClick={handleTransmutingFromGold}>transmuting from gold</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleGoldPriceKg}>gold price kg</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleGoldPriceGram}>gold price gram</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleGauPrice}>gau price</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleGaucPrice}>gauc price</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleVolumePN14d}>volume protons to neutrons 14d</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleVolumeNP14d}>volume neutrons to protons 14d</button>
        <button className="bg-red-700 px-2 py-1 rounded-full" onClick={handleVolumeArrayPN14d}>volume array protons to neutrons 14d</button>
        <button className="bg-red-700 px-2 py-1 rounded-full" onClick={handleVolumeArrayNP14d}>volume array neutrons to protons 14d</button>
        <button className="bg-red-700 px-2 py-1 rounded-full" onClick={handleFusionRatio}>fusion ratio</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleFees}>fees</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleFeesPercentage}>fees percentage</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleTvl}>tvl</button>
        <button className="bg-green-700 px-2 py-1 rounded-full" onClick={handleReserveRatio}>reserve ratio</button>
      </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-xl gap-4">
          <p>Connect your wallet to test</p>
          <WalletConnector />
        </div>
      )}
      </>
  );
}