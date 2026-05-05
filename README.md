# Discord Card Collector

This is a work in progress project that I began developing recently to expand my experience with databases. I'm using [drizzle ORM](https://orm.drizzle.team/) and [discord.js](https://discord.js.org/) to create a discord bot that allows users to collect and trade virtual cards with each other. The database is a SQLite database, and the project will be hosted on my [digitalocean droplet](https://www.digitalocean.com/products/droplets) once a usable version is complete.

The digital cards will use custom art which I plan to draw myself using a free open-source drawing program called [Krita](https://krita.org/en/).

## User Stories

**open daily pack:**

```/open {set_id}``` --> spends a pack voucher and gives the user x random cards from the specified set


**view collection:**

```/collection``` --> shows the users which cards they have collected (a list of all the card names with numbers next to them to show how many you have, and options to view the art for each one)


**make a trade:**

```/trade-offer  {card_type_id} {user_id} {card_type_id}``` --> initiates a trade between 2 users

```/trade-view``` --> lists all trades that have been proposed to the user who initiates the command

```/trade-accept {trade_id}``` --> accepts the trade

## DB Schema

Work in progress
