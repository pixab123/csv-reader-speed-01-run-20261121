import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { run } from "./solve.js";

const raw = readFileSync("/input/cases.json", "utf8");
const data = JSON.parse(raw);
const cases = Array.isArray(data) ? data : data.cases;
const answers = new Array(cases.length);
for (let k = 0; k < cases.length; k++) answers[k] = run(cases[k]);
mkdirSync("/output", { recursive: true });
writeFileSync("/output/answers.json", JSON.stringify(answers));
