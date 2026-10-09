import { Page } from "puppeteer";
import { BASE_URL } from "./config";
import type { CardDisplay } from "./types";
import { renderToString } from "hono/jsx/dom/server";

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

type CollectionProps = {
  cardDisplays: Array<CardDisplay>;
};

export function Collection({ cardDisplays }: CollectionProps) {
  return (
    <div
      style="
    display: grid;
    grid-template-columns: repeat(4, 300px);
    gap: 40px;"
    >
      {cardDisplays.map((cardDisplay) => (
        <Card {...cardDisplay} />
      ))}
    </div>
  );
}

export function Card(cardDisplayInfo: CardDisplay) {
  const rarityString = "*".repeat(cardDisplayInfo.rarityId + 1);

  const colors = rarityColors.get(cardDisplayInfo.rarityId)!;
  return (
    <div style="position: relative;">
      <div
        style={`
    display:flex;
    height:400px;
    width:300px;
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
  `}
      >
        <div
          style={`
      display:flex;
      width:85%;
      align-items:stretch;
      justify-content:space-between;
      flex-direction:row;
    `}
        >
          <p style="display:flex;">{cardDisplayInfo.cardName}</p>
        </div>

        <div
          style={`
      display:flex;
      width:90%;
      background-color:${colors.color2};
      justify-content:center;
      align-items:center;
      border-radius:20px;
      border-width:5px;
      border-color:white;
    `}
        >
          <img
            src={`${BASE_URL}/${cardDisplayInfo.imagePath}`}
            style="width:100%;"
          />
        </div>

        <div
          style="
      display:flex;
      width:90%;
      align-items:stretch;
      justify-content:space-between;
      flex-direction:row;
    "
        >
          <p style="display:flex;">{cardDisplayInfo.author}</p>
          <p style="display:flex;">
            {cardDisplayInfo.cardIndex}/{cardDisplayInfo.cardsInSet}{" "}
            {rarityString}
          </p>
        </div>
      </div>

      {cardDisplayInfo.displayCount !== undefined && (
        <div
          style="
        position: absolute;
        top: 0;
        right: 100;
        background: #c5c6c7e6;
        padding: 10px 30px;
        border-radius: 0 0 10px 10px;
        font-weight: bold;
        font-size: 25px;
        z-index: 1;
        box-shadow: 0px 8px 7px 4px rgba(0, 0, 0, 0.2);
    "
        >
          {cardDisplayInfo.displayCount}
        </div>
      )}
    </div>
  );
}

export async function getBufferFromHTML(page: Page, html: string) {
  await page.setContent(html);
  const pngBuffer = await page.screenshot({ omitBackground: true });
  return Buffer.from(pngBuffer);
}

export async function createCollectionPNG(
  page: Page,
  cardDisplays: Array<CardDisplay>,
) {
  await page.setViewport({
    width: 1350,
    height: 500,
  });

  const collectionHtml = renderToString(
    <Collection cardDisplays={cardDisplays} />,
  );
  return await getBufferFromHTML(page, collectionHtml);
}

export async function createCardPNG(
  page: Page,
  cardDisplayInfo: CardDisplay,
): Promise<Buffer> {
  await page.setViewport({
    width: 512,
    height: 580,
  });

  const cardHtml = renderToString(<Card {...cardDisplayInfo} />);
  return await getBufferFromHTML(page, cardHtml);
}
