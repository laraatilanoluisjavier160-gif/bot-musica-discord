const {
    Client,
    GatewayIntentBits,
    EmbedBuilder
} = require("discord.js");

const { DisTube } = require("distube");
const { YouTubePlugin } = require("@distube/youtube");
const express = require("express");

// =====================================================
// SERVIDOR WEB
// =====================================================

const app = express();

app.get("/", (req, res) => {
    res.send("🎵 Bot de música online");
});

app.listen(process.env.PORT || 3000, () => {
    console.log("🌐 Servidor web iniciado");
});

// =====================================================
// DISCORD
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// =====================================================
// DISTUBE
// =====================================================

const distube = new DisTube(client, {
    plugins: [
        new YouTubePlugin()
    ],
    emitNewSongOnly: true
});

const PREFIX = "!";

// =====================================================
// BOT LISTO
// =====================================================

client.once("ready", () => {
    console.log(`🤖 Bot conectado como ${client.user.tag}`);

    client.user.setActivity("Música 🎵", {
        type: 2
    });
});

// =====================================================
// COMANDOS
// =====================================================

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content
        .slice(PREFIX.length)
        .trim()
        .split(/ +/);

    const command = args.shift().toLowerCase();

    // =================================================
    // !PLAY
    // =================================================

    if (command === "play" || command === "p") {

        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel) {
            return message.reply(
                "❌ Primero entra a un canal de voz."
            );
        }

        const query = args.join(" ");

        if (!query) {
            return message.reply(
                "🎵 Escribe una canción o artista.\nEjemplo: `!play Peso Pluma`"
            );
        }

        try {

            await message.channel.send(
                `🔎 Buscando **${query}**...`
            );

            const results = await distube.search(query, {
                limit: 5,
                type: "video"
            });

            if (!results || results.length === 0) {
                return message.channel.send(
                    "❌ No encontré resultados."
                );
            }

            const lista = results
                .map((song, i) => {

                    const duracion =
                        song.formattedDuration ||
                        "Desconocida";

                    return (
                        `**${i + 1}.** ${song.name}\n` +
                        `⏱️ ${duracion}`
                    );
                })
                .join("\n\n");

            const embed = new EmbedBuilder()
                .setTitle(`🎵 Resultados para: ${query}`)
                .setDescription(lista)
                .setFooter({
                    text: "Escribe el número de la canción que quieres reproducir."
                });

            await message.channel.send({
                embeds: [embed]
            });

            // =================================================
            // ESPERAR ELECCIÓN
            // =================================================

            const filter = (msg) => {

                if (msg.author.id !== message.author.id) {
                    return false;
                }

                const numero = Number(msg.content);

                return (
                    Number.isInteger(numero) &&
                    numero >= 1 &&
                    numero <= results.length
                );
            };

            const collector =
                message.channel.createMessageCollector({
                    filter,
                    time: 30000,
                    max: 1
                });

            collector.on("collect", async (msg) => {

                const numero = Number(msg.content);

                const selected =
                    results[numero - 1];

                await msg.reply(
                    `🎶 Reproduciendo **${selected.name}**...`
                );

                try {

                    await distube.play(
                        voiceChannel,
                        selected.url,
                        {
                            textChannel: message.channel,
                            member: message.member,
                            message: msg
                        }
                    );

                } catch (error) {

                    console.error(error);

                    message.channel.send(
                        "❌ No pude reproducir esa canción."
                    );
                }
            });

            collector.on("end", (collected) => {

                if (collected.size === 0) {

                    message.channel.send(
                        "⌛ Se terminó el tiempo para elegir una canción."
                    );
                }
            });

        } catch (error) {

            console.error(error);

            message.channel.send(
                "❌ Ocurrió un error al buscar la música."
            );
        }
    }

    // =================================================
    // !SKIP
    // =================================================

    if (command === "skip" || command === "s") {

        const queue = distube.getQueue(message);

        if (!queue) {
            return message.reply(
                "❌ No hay ninguna canción reproduciéndose."
            );
        }

        try {

            await distube.skip(message);

            message.reply(
                "⏭️ Canción saltada."
            );

        } catch (error) {

            message.reply(
                "❌ No hay otra canción en la cola."
            );
        }
    }

    // =================================================
    // !STOP
    // =================================================

    if (command === "stop" || command === "leave") {

        const queue = distube.getQueue(message);

        if (!queue) {
            return message.reply(
                "❌ No hay música reproduciéndose."
            );
        }

        try {

            distube.stop(message);

            message.reply(
                "⏹️ Música detenida."
            );

        } catch (error) {

            console.error(error);

            message.reply(
                "❌ No pude detener la música."
            );
        }
    }
});

// =====================================================
// EVENTO: CANCIÓN REPRODUCIÉNDOSE
// =====================================================

distube.on("playSong", (queue, song) => {

    const duracion =
        song.formattedDuration ||
        (
            typeof song.formatDuration === "function"
                ? song.formatDuration()
                : "Desconocida"
        );

    const embed = new EmbedBuilder()
        .setTitle("🎶 Reproduciendo ahora")
        .setDescription(
            `**[${song.name}](${song.url})**`
        )
        .addFields({
            name: "⏱️ Duración",
            value: duracion,
            inline: true
        });

    queue.textChannel.send({
        embeds: [embed]
    });
});

// =====================================================
// ERRORES
// =====================================================

distube.on("error", (channel, error) => {

    console.error(error);

    if (channel) {
        channel.send(
            "❌ Ocurrió un error al reproducir la música."
        );
    }
});

// =====================================================
// TOKEN
// =====================================================

client.login(process.env.TOKEN);