import { Config } from "./config";
import { Gluon } from "./gluon";
import { NodeService } from "./nodeService";


const node = new NodeService("http://95.217.180.19:9053/")

async function testFission() {
    const gluon = new Gluon()
    const userBoxJs = await node.getBoxById("cb0237c893a7a9bc568b40f35a076ba49fe06cc2104dc641fc340b40fd5dc2a6")
    const oracleBoxJs = await gluon.getGoldOracleBox()
    const gluonBoxJs = await gluon.getGluonBox()
    const amountToFission = 1e9

    return await gluon.fissionForEip12(gluonBoxJs, oracleBoxJs, [userBoxJs], amountToFission)
}

async function testFusion() {
    const gluon = new Gluon()
    const userBoxJs = await node.getBoxById("cb0237c893a7a9bc568b40f35a076ba49fe06cc2104dc641fc340b40fd5dc2a6")
    const oracleBoxJs = await gluon.getGoldOracleBox()
    const gluonBoxJs = await gluon.getGluonBox()
    const amountToFusion = 1e8

    return await gluon.fusionForEip12(gluonBoxJs, oracleBoxJs, [userBoxJs], amountToFusion)
}

async function testBetaPlus() {
    const gluon = new Gluon()
    const userBoxJs = await node.getBoxById("cb0237c893a7a9bc568b40f35a076ba49fe06cc2104dc641fc340b40fd5dc2a6")
    const oracleBuyBackJs = await gluon.getOracleBuyBackBoxJs()
    const oracleBoxJs = await gluon.getGoldOracleBox()
    const gluonBoxJs = await gluon.getGluonBox()
    const height = await node.getNetworkHeight()

    const protonsToTransmute = 5000000
    return await gluon.transmuteToGoldForEip12(gluonBoxJs, oracleBoxJs, [userBoxJs], oracleBuyBackJs, protonsToTransmute, height)
}

async function testBetaMinus() {
    const gluon = new Gluon()
    const userBoxJs = await node.getBoxById("cb0237c893a7a9bc568b40f35a076ba49fe06cc2104dc641fc340b40fd5dc2a6")
    const oracleBuyBackJs = await gluon.getOracleBuyBackBoxJs()
    const oracleBoxJs = await gluon.getGoldOracleBox()
    const gluonBoxJs = await gluon.getGluonBox()

    const height = await node.getNetworkHeight()

    const neutronsToDecay = 2700000
    return await gluon.transmuteFromGoldForEip12(gluonBoxJs, oracleBoxJs, [userBoxJs], oracleBuyBackJs, neutronsToDecay, height)
}

async function testTVL() {
    const gluon = new Gluon()
    const gluonBoxJs = await gluon.getGluonBox()
    const oracleBoxJs = await gluon.getGoldOracleBox()
    return await gluon.getTVL(gluonBoxJs, oracleBoxJs)
}

async function testFusionRatio() {
    const gluon = new Gluon()
    const gluonBox = await gluon.getGluonBox()
    const oracleBox = await gluon.getGoldOracleBox()

    return await gluon.getReserveRatio(gluonBox, oracleBox)
}


// testFission().then((eip12Tx) => {
//     console.log('Fission:\n')
//     console.log(JSON.stringify(eip12Tx))
//     console.log('\n')
// })

// testFusion().then((eip12Tx) => {
//     console.log('Fusion:\n')
//     console.log(JSON.stringify(eip12Tx))
//     console.log('\n')
// })

// testBetaPlus().then((eip12Tx) => {
//     console.log('Transmute to Gold:\n')
//     console.log(JSON.stringify(eip12Tx))
//     console.log('\n')
// })

// testBetaMinus().then((eip12Tx) => {
//     console.log('Transmute from Gold:\n')
//     console.log(JSON.stringify(eip12Tx))
//     console.log('\n')
// })

testTVL().then((tvl) => {
    console.log('TVL:\n')
    console.log(Number(tvl) / 1e9)
    console.log('\n')
})

testFusionRatio().then((ratio) => {
    console.log('Fusion Ratio:\n')
    console.log(Number(ratio))
    console.log('\n')
})