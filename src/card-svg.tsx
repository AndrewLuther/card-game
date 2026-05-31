import satori from "satori";
import * as fs from 'node:fs';
import { baseUrl } from ".";
import { Hono } from "hono";
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server'
import { Resvg } from "@resvg/resvg-js";

const honoApp = new Hono();
honoApp.use('/images/*', serveStatic({root: './public'}))
export default honoApp

export async function createCardPNG(cardName:string, imagePath:string, author:string, cardIndex:number, rarityString:string ) {
    const inter = fs.readFileSync("./src/Inter-Regular.ttf");
    const svg = await satori(
    <div style={{ display: "flex",  height: "100%", width:"100%", backgroundColor: "#0058AB", color: "white", justifyContent:"center", alignItems:"center",  flexDirection: "column", borderRadius:"40px", borderWidth:"10px", borderColor:"#001425", boxShadow:"inset 0px 0px 80px 8px #00245d"}}>
      <div style={{display: "flex", width: "85%", alignItems:"stretch", justifyContent:"space-between", flexDirection:"row"}}>
        <p style={{display:"flex"}}>{cardName}</p>
      </div>
      <div style={{display: "flex", width: "90%", backgroundColor: "#368DC5", justifyContent:"center", alignItems:"center", borderRadius:"20px", borderWidth:"5px", borderColor:"white"}}>
        <img src={`${baseUrl}/${imagePath}`} style={{width:"100%"}}/>
      </div>
      <div style={{display: "flex", width: "90%", alignItems:"stretch", justifyContent:"space-between", flexDirection:"row"}}>
        <p style={{display:"flex"}}>{author}</p>
        <p style={{display:"flex"}}>{`${cardIndex}/5 ${rarityString}`}</p>
      </div>
    </div>,
    {
      width: 512,
      height: 580,
      fonts: [
        {
          name: "Inter",
          data: inter,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );

  const resvg = new Resvg(svg)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  return pngBuffer
}
