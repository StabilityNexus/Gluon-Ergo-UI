import { Serializer } from "./serializer";

export class GoldOracleBox {
  boxJs: any;
  serializer: Serializer;

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
   * returns gold price for 1 kg
   */
  async getPrice(): Promise<number> {
    const registers = this.getRegisters();
    const decodedValue = await this.serializer.decodeJs(registers[0]);
    return Number(decodedValue);
  }

  /**
   * returns gold price for 1 gram
   */
  async getPricePerGram(): Promise<number> {
    const price = await this.getPrice();
    return Math.floor(price / 1000);
  }
}
