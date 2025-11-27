export const protocolConfig = {
  peg: {
    asset: "Gold",
    adjective: "Gold-Pegged",
    description: "digital gold-pegged tokens",
  },
  tokens: {
    /**
     * Neutron = stable token in the Gluon protocol.
     * For the current deployment this corresponds to GAU.
     */
    neutron: {
      ticker: "GAU",
      name: "Gluon Gold",
      shortDescription: "Stable token pegged to 1g of Gold.",
    },
    /**
     * Proton = volatile token in the Gluon protocol.
     * For the current deployment this corresponds to GAUC.
     */
    proton: {
      ticker: "GAUC",
      name: "Gluon Gold Certificate",
      shortDescription: "Volatile token that tokenizes the reserve surplus.",
    },
  },
  seo: {
    defaultTitle: "Gluon | Gold Protocol on Ergo",
    defaultDescription:
      "Gluon is a decentralized finance protocol on Ergo blockchain that enables users to trade, swap, and manage gold-backed tokens.",
    defaultKeywords: "Gluon, Ergo, DeFi, Blockchain, Cryptocurrency, Gold-backed tokens, GAU, GAUC, Digital Assets",
    defaultUrl: "https://www.gluon.gold/",
    defaultImage: "/logo/gluon.png",
  },
  ui: {
    hero: {
      tagline: "Trade and transact with digital gold-pegged tokens.",
      subTagline: "Secured by the Ergo blockchain and its decentralized gold price oracle.",
    },
    labels: {
      navbarTitle: "GLUON GOLD",
      telegramHandle: "GluonGold",
      assetPriceTitle: "1 kg of Gold",
      assetPriceSubtitle: "Oracle Gold Price",
      neutronSubtitle: "Gold Pegged Token",
      protonSubtitle: "Leveraged Yield Token",
      neutronSupplyLabel: "GAU Supply",
      protonSupplyLabel: "GAUC Supply",
    },
  },
} as const;

export type ProtocolConfig = typeof protocolConfig;


