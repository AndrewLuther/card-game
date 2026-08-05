import satori from "satori";
import * as fs from 'node:fs';
import { baseUrl } from ".";
import { Hono } from "hono";
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server'
import { Resvg } from "@resvg/resvg-js";

import { Page } from "puppeteer";

const honoApp = new Hono();
honoApp.use('/images/*', serveStatic({root: './public'}))
export default honoApp

export async function createCardPNG(page:Page, cardName:string, imagePath:string, author:string, cardIndex:number, rarityString:string ): Promise<Buffer> {
  const html = `
  <div style="
    display:flex;
    height:auto;
    width:auto;
    background-color:#0058AB;
    color:white;
    justify-content:center;
    align-items:center;
    flex-direction:column;
    border-radius:40px;
    border-width:10px;
    border-style:solid;
    border-color:#001425;
    box-shadow:inset 0px 0px 80px 8px #00245d;
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
      background-color:#368DC5;
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
      <p style="display:flex;">${cardIndex}/5 ${rarityString}</p>
    </div>
  </div>
  `;    

  await page.setViewport({
    width: 512,
    height: 580
  });
    
  await page.setContent(html);

  const pngbuffer = await page.screenshot({omitBackground:true});

  return Buffer.from(pngbuffer)


}
