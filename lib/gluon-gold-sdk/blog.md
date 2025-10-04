# Building a Website with the Gluon Gold SDK

## Introduction

The Gluon Gold SDK is a powerful tool designed to facilitate interaction with the Gluon protocol, which operates on the Ergo blockchain. This SDK allows developers to perform complex operations easily such as fission, fusion, and transmutations of Neutrons and Protons, using ERGs (Ergo's native cryptocurrency). The SDK is particularly useful for developers looking to integrate these functionalities into web applications, bots, etc. This enables users to interact with the Gluon protocol directly from their browsers.

In this blog post, we will explore how to use the Gluon Gold SDK to in a website that interacts with the Gluon protocol. We will focus on utilizing the SDK's functionalities to perform the four main operations: fission, fusion, transmuting to gold, and transmuting from gold. Additionally, we will discuss how to display relevant Gluon Gold data, such as fusion ratio, prices, fees, etc. to users.

## Getting Started with the Gluon Gold SDK

### Installation

To begin, install the Gluon Gold SDK using npm:

```bash
npm install gluon-gold-sdk@1.0.0
```

### Importing the SDK in the Browser

To use the SDK in a browser environment, you can dynamically import it as follows:

```javascript
if (typeof window !== "undefined") {
  gluon = import("gluon-gold-sdk");
}
```

### Creating an Instance of the SDK

```javascript
const resolvedGluon = await gluon;
const gluonInstance = new resolvedGluon.Gluon();
```

### Adjusting the Gluon Gold SDK Constant Parameters

Before you start performing operations with the Gluon Gold SDK, it's important to configure the SDK with the appropriate parameters. This ensures that the SDK operates correctly within your desired network environment and with the specified fees.

To adjust the constant parameters, you can create a new instance of the `Config` class and set the necessary properties. Here's an example of how to do this:

```javascript
// Create a new configuration instance
const config = new Config();

// Set the network to the desired environment (e.g., 'mainnet' or 'testnet')
config.NETWORK = "mainnet"; // or 'testnet'

// Set the miner fee (in nanoERGs)
config.MINER_FEE = 1000000; // Example: 0.001 ERG

// Set the UI fee (in nanoERGs), where 1000 nanoERGs represent 1%
config.UI_FEE = 1000; // Example: 1% fee

// Set the node URL for connecting to the Ergo blockchain
config.NODE_URL = "https://ergo-node.example.com";

// Set the UI tree, which is used for specific UI-related operations
config.UI_TREE = "your-ui-tree-value-here";
```

By configuring these parameters, you ensure that the SDK is tailored to your application's requirements, allowing for seamless interaction with the Gluon protocol. Adjust these values according to your specific needs and the environment in which your application will operate.

### Setting Up the Environment

To perform operations with the Gluon Gold SDK, it's crucial to first obtain the necessary boxes from the Gluon protocol. These boxes represent specific states on the blockchain and are essential for executing transactions like fission, fusion, and transmutation.

The Gluon protocol operates on the Ergo blockchain, and to interact with it, your application needs to fetch the latest state of these boxes. This is done by connecting to a node, which acts as a gateway to the blockchain, providing access to the most recent data.

Here's how you can set up the environment by fetching the required boxes:

```javascript
// Fetch the current unspent Gold Oracle Box
const oracleBoxJs = await gluonInstance.getGoldOracleBox();

// Fetch the current unspent Gluon Box
const gluonBoxJs = await gluonInstance.getGluonBox();
```

**Why Refresh the Boxes?**

The state of the blockchain is dynamic, with transactions occurring continuously. By periodically refreshing these boxes, you ensure that your application is working with the most up-to-date information. These boxes are updated whenever a transaction is made or the oracle price is updated, so it's important to keep them updated to avoid using stale data.

### User Interaction with Nautilus Wallet

You can use any approach to get the user's boxes. One of the most common approaches is to use the `ergo.get_utxos` to fetch the user's boxes from the Nautilus wallet.

```javascript
const userBoxes = await ergo.get_utxos();
```

## Performing Operations with the SDK

### Fission

Fission is the process of converting ERGs into Neutrons and Protons. Here's how you can perform a fission operation:

```javascript
const amountToFission = ... // amount in nanoERGs
const unsignedTransaction = await gluonInstance.fissionForEip12(gluonBoxJs, oracleBoxJs, userBoxes, amountToFission);
```

### Fusion

Fusion is the reverse process, where Neutrons and Protons are converted back into ERGs:

```javascript
const amountToFusion = ... // amount in nanoERGs
const unsignedTransaction = await gluonInstance.fusionForEip12(gluonBoxJs, oracleBoxJs, userBoxes, amountToFusion);
```

### Transmuting to Gold

This operation involves sending Protons to the reactor to receive Neutrons:

```javascript
const protonsToTransmute = 5000000; // Example amount
const height = await nodeService.getNetworkHeight(); // Get current network height
const oracleBuyBackJs = await gluonInstance.getOracleBuyBackBoxJs();
const unsignedTransaction = await gluonInstance.transmuteToGoldForEip12(
  gluonBoxJs,
  oracleBoxJs,
  userBoxes,
  oracleBuyBackJs,
  protonsToTransmute,
  height
);
```

### Transmuting from Gold

This operation involves sending Neutrons to the reactor to receive Protons:

```javascript
const neutronsToDecay = 2700000; // Example amount
const unsignedTransaction = await gluonInstance.transmuteFromGoldForEip12(
  gluonBoxJs,
  oracleBoxJs,
  userBoxes,
  oracleBuyBackJs,
  neutronsToDecay,
  height
);
```

### Signing the Transaction

You can use any method to sign the transaction. One of the most common methods is to use the `sign_tx` method provided by the Nautilus wallet.

```javascript
const signedTransaction = await ergo.sign_tx(unsignedTransaction);
```

The signed transaction can then be submitted to the network using the `submit_tx` method provided by the Nautilus wallet.

```javascript
const txId = await ergo.submit_tx(signedTransaction);
```

It is important to catch any errors that may occur during the transaction signing and submission process and display them to the user.

## Displaying Gluon Gold Data

To provide users with detailed information about the Gluon Gold protocol, such as fusion ratio, prices, fees, etc., you can use the SDK's methods to calculate and display these values:

### Calculating Fees

For each operation, you can calculate the total fees and their breakdown:

```javascript
const fees = await gluonInstance.getTotalFeeAmountFission(gluonBoxJs, amountToFission);
console.log(
  `Developer Fee: ${fees.devFee}, UI Fee: ${fees.uiFee}, Oracle Fee: ${fees.oracleFee}, Total Fee: ${fees.totalFee}`
);
```

These fees can be shown to the user in the UI so they know what to expect in terms of costs for the operation. These fees are in nanoERGs.

### Displaying Prices

You can also display the current prices of Neutrons and Protons:

```javascript
const neutronPrice = await gluonInstance.neutronPrice(oracleBoxJs);
const protonPrice = await gluonInstance.protonPrice(oracleBoxJs);
const oracleGoldPricePerKg = await oracleBoxJs.getPrice();
const oracleGoldPricePerGram = await oracleBoxJs.getPricePerGram();

console.log(
  `Neutron Price: ${neutronPrice}, Proton Price: ${protonPrice}, Gold Price: ${oracleGoldPricePerKg}, Gold Price Per Gram: ${oracleGoldPricePerGram}`
);
```

These values should be displayed in the website to users so they know what the current price of the assets are. They can easily be called with the updated oracle box to get the latest price periodically.

### N-Day Volume Calculation

The SDK provides methods to calculate the operation volumes over a specified number of days (up to 14 days). You can calculate the volume of protons to neutrons or neutrons to protons.

```javascript
// Calculate the n-day volume of protons to neutrons
const n = 7; // specify the number of days
const volumeProtonsToNeutrons = await gluon.accumulateVolumeProtonsToNeutrons(n);

// Calculate the n-day volume of neutrons to protons
const volumeNeutronsToProtons = await gluon.accumulateVolumeNeutronsToProtons(n);

console.log(`Volume of protons to neutrons over ${n} days:`, volumeProtonsToNeutrons);
console.log(`Volume of neutrons to protons over ${n} days:`, volumeNeutronsToProtons);
```

Displaying these to the user will give them a good idea of the trend of the protocol.

## Conclusion

The Gluon Gold SDK provides a comprehensive set of tools for interacting with the Gluon protocol on the Ergo blockchain. By integrating this SDK into your website, you can offer users the ability to perform complex financial operations directly from their browsers. Whether it's fission, fusion, or transmutation, the SDK simplifies these processes and provides detailed transaction data to enhance user experience.

By following the steps outlined in this blog post, you can effectively leverage the Gluon Gold SDK to build a robust web application that interacts seamlessly with the Gluon protocol.
