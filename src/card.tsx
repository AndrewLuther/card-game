import satori from "satori";
import * as fs from "node:fs";
import { baseUrl } from ".";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { Resvg } from "@resvg/resvg-js";

import { Page } from "puppeteer";

const honoApp = new Hono();
honoApp.use("/images/*", serveStatic({ root: "./public" }));
export default honoApp;

type RarityColors = {
  color1: string;
  color2: string;
  color3: string;
};

const rarityColors = new Map<number, RarityColors>([
  [
    0,
    {
      color1: "#0058AB",
      color2: "#368DC5",
      color3: "#00245d",
    },
  ],
  [
    1,
    {
      color1: "#018310",
      color2: "#6bc575",
      color3: "#003106",
    },
  ],
  [
    2,
    {
      color1: "#c15e0e",
      color2: "#d78746",
      color3: "#522a0a",
    },
  ],
]);

export async function createCardPNG(
  page: Page,
  cardName: string,
  imagePath: string,
  author: string,
  cardIndex: number,
  rarityId: number,
  cardsInSet: number,
): Promise<Buffer> {
  const rarityString = "*".repeat(rarityId + 1);

  const colors = rarityColors.get(rarityId)!;

  const html = `
  <div style="
    display:flex;
    height:auto;
    width:auto;
    background-color:${colors.color1};
    color:white;
    justify-content:center;
    align-items:center;
    flex-direction:column;
    border-radius:40px;
    border-width:10px;
    border-style:solid;
    border-color: #c5c6c7;
    box-shadow:inset 0px 0px 80px 8px ${colors.color3};
  ">
    <div style="
      display:flex;
      width:85%;
      align-items:stretch;
      justify-content:space-between;
      flex-direction:row;
    ">
      <p style="display:flex;">${cardName}</p>
    </div>

    <div style="
      display:flex;
      width:90%;
      background-color:${colors.color2};
      justify-content:center;
      align-items:center;
      border-radius:20px;
      border-width:5px;
      border-color:white;
    ">
      <img src="${baseUrl}/${imagePath}" style="width:100%;" />
    </div>

    <div style="
      display:flex;
      width:90%;
      align-items:stretch;
      justify-content:space-between;
      flex-direction:row;
    ">
      <p style="display:flex;">${author}</p>
      <p style="display:flex;">${cardIndex}/${cardsInSet} ${rarityString}</p>
    </div>
  </div>
  `;

  await page.setViewport({
    width: 512,
    height: 580,
  });

  await page.setContent(html);

  const pngbuffer = await page.screenshot({ omitBackground: true });

  return Buffer.from(pngbuffer);
}
