import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { run } from "./solve.js";

const inputDir = process.env.MAKEFUN_INPUT_DIR || "/input";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const raw = readFileSync(inputDir + "/cases.json", "utf8");
const data = JSON.parse(raw);
const cases = Array.isArray(data) ? data : data.cases;
const answers = new Array(cases.length);
for (let k = 0; k < cases.length; k++) {
  const c = cases[k];
  answers[k] = run(c && c.input ? c.input : c);
}
mkdirSync(outputDir, { recursive: true });
writeFileSync(outputDir + "/answers.json", JSON.stringify(answers));
