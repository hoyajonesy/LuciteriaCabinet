import { ELEMENTS_118 } from './app/data/elements.server.js';

console.log("Total elements loaded:", ELEMENTS_118.length);
ELEMENTS_118.forEach(e => {
  console.log(`${e.z}\t${e.sym}\t${e.name}\tRow:${e.row}\tCol:${e.col}\tSizes:${e.size}`);
});
