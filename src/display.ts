import {
  ContainerBuilder,
  SectionBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from "discord.js";
import type { Card } from "./types";

export function createOverviewContainer(username: String, userCards: Card[]) {
  //   const button = new ButtonBuilder()
  //     .setCustomId("my_button")
  //     .setLabel("Click me")
  //     .setStyle(ButtonStyle.Primary);

  //   const section = new SectionBuilder()
  //     .addTextDisplayComponents((text) => text.setContent(`**${username}**`))
  //     .setButtonAccessory((button) =>
  //       button
  //         .setCustomId("exampleButton")
  //         .setLabel("Button inside a Section")
  //         .setStyle(ButtonStyle.Primary),
  //     );

  const text = new TextDisplayBuilder().setContent(
    `**${username}** | ${userCards.length} Cards`,
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(text)
    .setAccentColor(0);
  return container;
}

export function createMenu() {
  const favoriteStarterSelect = new StringSelectMenuBuilder()
    .setCustomId("starter")
    .setPlaceholder("Make a selection!")
    .addOptions(
      // String select menu options
      new StringSelectMenuOptionBuilder()
        // Label displayed to user
        .setLabel("Bulbasaur")
        // Description of option
        .setDescription("The dual-type Grass/Poison Seed Pokémon.")
        // Value returned in select menu interaction
        .setValue("bulbasaur"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Charmander")
        .setDescription("The Fire-type Lizard Pokémon.")
        .setValue("charmander"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Squirtle")
        .setDescription("The Water-type Tiny Turtle Pokémon.")
        .setValue("squirtle"),
    );

  return favoriteStarterSelect;
}
