export const CATS = [
  { n: "식비", c: "--c1" },
  { n: "카페·간식", c: "--c2" },
  { n: "교통", c: "--c3" },
  { n: "약속", c: "--c4" },
  { n: "쇼핑", c: "--c5" },
  { n: "미용", c: "--c6" },
  { n: "기타", c: "--c7" },
];
export const catVar = (name: string | undefined) => "var(" + (CATS.find((c) => c.n === name) || CATS[6]).c + ")";
