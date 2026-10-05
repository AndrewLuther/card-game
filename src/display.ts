import {
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from "discord.js";
import type { Card } from "./types";
import { BASE_URL } from "./config";

export function createOverviewContainer(username: String, userCards: Card[]) {
  const numUniqueCards = new Set(userCards.map((row) => row.cardtype_id)).size;

  const text = new TextDisplayBuilder().setContent(
    `**${username}** | ${userCards.length} total card(s) | ${numUniqueCards} unique card(s)`,
  );

  console.log(BASE_URL + "/images/guppy.png");

  const container = new ContainerBuilder()
    .addTextDisplayComponents(text)
    .setAccentColor(0)
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(BASE_URL + "/images/guppy.png"),
      ),
    );
  return container;
}
