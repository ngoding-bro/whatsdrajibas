import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import P from 'pino';
import figlet from 'figlet';
import qrcode from 'qrcode-terminal';
import chalkRainbow from 'chalk-rainbow';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { jbssms } from "./db/index.js"; 
import { formatWhatsappNumber } from './msgHndlr.js';
const authPath = './auth_folder';
const cacheFile = path.resolve('./outbox_cache.json');
let myInterval;
const readCache = () => {
    if (fs.existsSync(cacheFile)) {
        const data = fs.readFileSync(cacheFile, 'utf-8');
        return JSON.parse(data);
    }
    return [];
};
const writeCache = (data) => {
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8');
};
process.on('SIGINT', () => {
    if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
        console.log(chalk.redBright("Cache outbox dihapus saat bot dimatikan."));
    }
    process.exit();
});
const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false
    });
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('Silakan scan QR code ini dengan WhatsApp Anda');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            if (myInterval) {
                clearInterval(myInterval);
            }
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('Koneksi terputus. Coba menyambung ulang...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Bot berhasil terhubung ke WhatsApp!');
            const sendDatabaseData = async () => {
                try {
                    const [rows] = await jbssms.query("SELECT * FROM outbox ORDER BY ID ASC");
                    let cache = readCache();
                    if (cache.length === 0) {
                        // Pertama kali: hanya simpan semua data, tidak kirim pesan
                        console.log("Ambil semua data awal dari DB (hanya simpan ke cache)...");
                        writeCache(rows);
                    } else {
                        // Cek data baru (ID lebih besar dari cache terakhir)
                        const lastId = cache[cache.length - 1]?.ID || 0;
                        const newRows = rows.filter(r => r.ID > lastId);
                        if (newRows.length > 0) {
                            console.log("Ada data baru:", newRows);
                            for (const row of newRows) {
                                const textMsg = row.Text;
                                const phoneNumber = row.DestinationNumber;
                                const jid = formatWhatsappNumber(phoneNumber);
                                try {
                                    await sock.sendMessage(jid, { text: `${textMsg}` });
                                    console.log(chalk.green(`Pesan terkirim ke ${jid}: ${textMsg}`));
                                } catch (sendErr) {
                                    console.error(chalk.red(`Gagal kirim ke ${jid}:`), sendErr);
                                }
                            }
                            const updatedCache = [...cache, ...newRows];
                            writeCache(updatedCache);
                        } else {
                            console.log("Tidak ada data baru, skip...");
                        }
                    }
                } catch (err) {
                    console.error("Error MySQL:", err);
                }
            };
            sendDatabaseData();
            myInterval = setInterval(sendDatabaseData, 5 * 60 * 1000);
            const fullText = "SKARSA BY INDRA";
            figlet.text(fullText, {
                font: 'Ghost',
                horizontalLayout: 'default',
                verticalLayout: 'default',
                width: 80,
                whitespaceBreak: true
            }, (err, data) => {
                if (err) {
                    console.log('Ada yang salah dengan figlet...');
                    console.dir(err);
                    return;
                }
                console.log(chalkRainbow(data));
            });
        }
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message.key.fromMe && message.message) {
            const remoteJid = message.key.remoteJid;
            const textMessage = message.message?.extendedTextMessage?.text || message.message?.conversation;
            if (textMessage) {
                await sock.sendMessage(remoteJid, { text: `Pesan diterima: ${textMessage}`});
            }
        }
    });
};
startBot();