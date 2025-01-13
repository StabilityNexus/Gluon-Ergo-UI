  export const nanoErgsToErgs = (nanoErgs: number | bigint) => {
    if (typeof nanoErgs === 'bigint') {
        return Number(nanoErgs) / Math.pow(10, 9);
    }
    return nanoErgs / Math.pow(10, 9);
  }
  
  export const ergsToNanoErgs = (ergs: number) => {
    return ergs * Math.pow(10,9);
  }

  export const UIFriendlyValue = (input: number | bigint, divisor?: number) => {
    if (typeof input === 'bigint') {
        return Number(input) / Math.pow(10, divisor ?? 9);
    }
    return input / Math.pow(10, divisor ?? 9);
  }
  
  export const APIFriendlyValue = (input: number, divisor?: number) => {
    return BigInt(Math.floor(input * Math.pow(10, divisor ?? 9)));
  }