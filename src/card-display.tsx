import { Page } from "puppeteer";
import { BASE_URL } from "./config";
import type { CardDisplay } from "./types";
import { renderToString } from "hono/jsx/dom/server";
import { readFileSync } from "node:fs";

const css = readFileSync("./src/Card.css", "utf-8");

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

const missingColors = {
  color1: "#ababab",
  color2: "#c2c0c0",
  color3: "#6a6a6a",
};

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
  const rarityString = "◆".repeat(cardDisplayInfo.rarityId + 1);

  const colors = rarityColors.get(cardDisplayInfo.rarityId)!;
  return (
    <>
      <style>{css}</style>
      <div className="card-container">
        <div
          className="card"
          style={{
            "--card-color-1":
              cardDisplayInfo.displayCount == 0
                ? missingColors.color1
                : colors.color1,
            "--card-color-2":
              cardDisplayInfo.displayCount == 0
                ? missingColors.color2
                : colors.color2,
            "--card-color-3":
              cardDisplayInfo.displayCount == 0
                ? missingColors.color3
                : colors.color3,
          }}
        >
          <div className="card-header">
            <p className="card-name">
              {cardDisplayInfo.displayCount == 0
                ? "???"
                : cardDisplayInfo.cardName}
            </p>
          </div>

          <div className="card-image-container">
            {cardDisplayInfo.displayCount !== 0 && (
              <img
                src={`${BASE_URL}/${cardDisplayInfo.imagePath}`}
                className="card-image"
              />
            )}

            {cardDisplayInfo.displayCount == 0 && (
              <div className="card-image-placeholder" />
            )}
          </div>

          <div className="card-footer">
            <p className="card-author">
              illus:{" "}
              {cardDisplayInfo.displayCount == 0
                ? "???"
                : cardDisplayInfo.author}
            </p>

            <p className="card-rarity">{rarityString}</p>
          </div>
        </div>

        {cardDisplayInfo.displayCount !== undefined && (
          <div className="card-count">{cardDisplayInfo.displayCount}</div>
        )}
      </div>
    </>
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
  const rows: number = Math.ceil(cardDisplays.length / 4);

  await page.setViewport({
    width: 1390,
    height: 420 * rows + 40 * (rows - 1) + 40,
    deviceScaleFactor: 2,
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
