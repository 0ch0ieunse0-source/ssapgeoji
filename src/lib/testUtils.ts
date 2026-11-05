import { EMPTY } from "./storage";
import type { Data, Item, Settings } from "./types";

export function makeCfg(over: Partial<Settings> = {}): Settings {
  return {
    name: "",
    cycleDay: 1,
    total: 400000,
    autoLimits: false,
    weekday: 10000,
    weekend: 10000,
    appts: [],
    apptLimit: 0,
    balance: null,
    balanceDate: null,
    payday: null,
    salary: null,
    fixed: [],
    cardPay: null,
    cardCut: null,
    goalAmt: null,
    goalDate: null,
    firstStart: null,
    ...over,
  };
}

let n = 0;
export function item(amount: number, over: Partial<Item> = {}): Item {
  return { id: "i" + n++, amount, memo: "", cat: "식비", pay: "check", t: 0, ...over };
}

export function dataWith(over: Partial<Data> = {}): Data {
  return { ...EMPTY(), ...over };
}
